import {
  db,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  auth,
  signInWithEmailAndPassword,
} from './firebase';
import { INITIAL_CATALOG, INITIAL_JOBS } from '../mockData/initialData';

const GLOBAL_STORE_DOC_ID = 'blp_main_store';

// Unique ID for this browser session — used to identify our own pushes
// so we don't re-apply our own echo from Firestore
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Set of updatedAt timestamps that WE generated (our own pushes)
// We skip snapshots where pushedBy === SESSION_ID
const localPushTimestamps = new Set();

const ensureAuth = async () => {
  if (!auth.currentUser) {
    try {
      await signInWithEmailAndPassword(auth, 'blp_system_admin@blp.cz', 'blpblp2026!');
      console.log('[FirebaseDb] Auto-authenticated system user:', auth.currentUser?.uid);
    } catch (e) {
      console.warn('[FirebaseDb] Auto-auth note:', e?.message);
    }
  }
};

const writeLocalCache = (data) => {
  let hasNewLocalData = false;


  // Merge jobs: don't wipe newly created local jobs if remote snapshot is slightly older
  if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) {
    const localJobs = JSON.parse(localStorage.getItem('blp_jobs_v2') || '[]');
    const remoteJobIds = new Set(data.jobs.map(j => j.id));
    // Keep local jobs that aren't in remote yet (recently created)
    const pendingLocalJobs = localJobs.filter(lj => !remoteJobIds.has(lj.id));
    if (pendingLocalJobs.length > 0) hasNewLocalData = true;
    const mergedJobs = [...data.jobs, ...pendingLocalJobs];
    localStorage.setItem('blp_jobs_v2', JSON.stringify(mergedJobs));
  }

  // Merge jobItems
  if (data.jobItems && Array.isArray(data.jobItems)) {
    const localItems = JSON.parse(localStorage.getItem('blp_job_items_v2') || '[]');
    const remoteItemIds = new Set(data.jobItems.map(i => i.id));
    const pendingLocalItems = localItems.filter(li => !remoteItemIds.has(li.id));
    if (pendingLocalItems.length > 0) hasNewLocalData = true;
    const mergedItems = [...data.jobItems, ...pendingLocalItems];
    localStorage.setItem('blp_job_items_v2', JSON.stringify(mergedItems));
  }

  // Catalog: preserve rich 60+ Master Catalog
  if (data.catalog && Array.isArray(data.catalog) && data.catalog.length >= 20) {
    localStorage.setItem('blp_catalog_v2', JSON.stringify(data.catalog));
  } else {
    const localCat = JSON.parse(localStorage.getItem('blp_catalog_v2') || '[]');
    if (localCat.length < 20) {
      localStorage.setItem('blp_catalog_v2', JSON.stringify(INITIAL_CATALOG));
    }
  }

  if (data.consumables && Array.isArray(data.consumables)) {
    localStorage.setItem('blp_consumables_v2', JSON.stringify(data.consumables));
  }
  if (data.auditLogs && Array.isArray(data.auditLogs)) {
    localStorage.setItem('blp_audit_logs_v2', JSON.stringify(data.auditLogs));
  }

  return hasNewLocalData;
};

export const firebaseDb = {
  /**
   * Pushes full application payload to Cloud Firestore.
   * Tags the document with this session's ID so the listener can ignore its own echo.
   */
  async pushPayload(payload) {
    try {
      await ensureAuth();
      const updatedAt = new Date().toISOString();
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);

      // Register this timestamp as ours BEFORE the push (in case snapshot arrives fast)
      localPushTimestamps.add(updatedAt);
      // Clean up old timestamps after 5 seconds to avoid memory leak
      setTimeout(() => localPushTimestamps.delete(updatedAt), 5000);

      // Ensure catalog has all items
      const catalogToPush = (payload.catalog && payload.catalog.length >= 20)
        ? payload.catalog
        : INITIAL_CATALOG;

      await setDoc(mainRef, {
        updatedAt,
        pushedBy: SESSION_ID,        // ← identifies the source device/session
        version: '3.0',
        jobs: payload.jobs || [],
        jobItems: payload.jobItems || [],
        catalog: catalogToPush,
        consumables: payload.consumables || [],
        auditLogs: payload.auditLogs || [],
      }, { merge: true });

      console.log('[FirebaseDb] ✅ Push OK:', updatedAt, '| session:', SESSION_ID.slice(0, 16));
      return { success: true };
    } catch (err) {
      console.error('[FirebaseDb] ❌ Push ERROR:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Directly pulls latest payload from Cloud Firestore (one-shot read).
   * Used on app startup and on visibility change.
   */
  async pullFromCloud() {
    try {
      await ensureAuth();
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      const snap = await getDoc(mainRef);
      if (snap.exists()) {
        const data = snap.data();
        const hasNewLocalData = writeLocalCache(data);
        console.log('[FirebaseDb] ✅ Pull OK:', data.updatedAt, '| from:', data.pushedBy?.slice(0, 16));

        if (hasNewLocalData) {
          console.log('[FirebaseDb] Local device has items not yet in cloud. Auto-pushing to cloud...');
          this.pushPayload({
            jobs: JSON.parse(localStorage.getItem('blp_jobs_v2') || '[]'),
            jobItems: JSON.parse(localStorage.getItem('blp_job_items_v2') || '[]'),
            catalog: JSON.parse(localStorage.getItem('blp_catalog_v2') || '[]'),
            consumables: JSON.parse(localStorage.getItem('blp_consumables_v2') || '[]'),
            auditLogs: JSON.parse(localStorage.getItem('blp_audit_logs_v2') || '[]'),
          });
        }

        return { success: true, data };
      }
      console.warn('[FirebaseDb] Pull: document does not exist yet in Firestore.');
      return { success: false, error: 'Dokument v cloudu neexistuje.' };
    } catch (err) {
      console.error('[FirebaseDb] ❌ Pull ERROR:', err.message);
      return { success: false, error: err.message };
    }
  },


  /**
   * Subscribes to realtime Firestore snapshots.
   * Calls onUpdate ONLY when the change came from ANOTHER device/session.
   *
   * Echo prevention: checks `pushedBy` field — if it matches our SESSION_ID,
   * this is our own echo and we skip it.
   */
  subscribeToCloud(onUpdate) {
    try {
      ensureAuth();
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);

      const unsubscribe = onSnapshot(
        mainRef,
        { includeMetadataChanges: true },
        (snap) => {
          if (!snap.exists()) return;

          // Skip optimistic/pending local writes — only process server-confirmed data
          if (snap.metadata.hasPendingWrites) {
            console.log('[FirebaseDb] Listener: skipping pending write (not yet confirmed by server)');
            return;
          }

          const data = snap.data();

          // Echo prevention: if this snapshot was pushed by THIS session, ignore it
          if (data.pushedBy === SESSION_ID) {
            console.log('[FirebaseDb] Listener: skipping own echo (pushedBy matches session)');
            return;
          }

          // This is a genuine remote update from another device
          console.log('[FirebaseDb] 🔔 Remote update from:', data.pushedBy?.slice(0, 16), '| updatedAt:', data.updatedAt);
          writeLocalCache(data);

          if (onUpdate) onUpdate(data);
        },
        (err) => {
          // Non-fatal — can happen when offline or Firestore rules are strict
          console.warn('[FirebaseDb] Listener warning:', err.code, err.message);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[FirebaseDb] Subscribe error:', err.message);
      return () => {};
    }
  },
};
