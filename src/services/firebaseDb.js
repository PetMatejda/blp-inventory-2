import {
  db,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from './firebase.js';
import { INITIAL_CATALOG, INITIAL_JOBS } from '../mockData/initialData.js';

const GLOBAL_STORE_DOC_ID = 'blp_main_store';

// Unique ID for this browser session — used to identify our own pushes
// so we don't re-apply our own echo from Firestore
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Set of updatedAt timestamps that WE generated (our own pushes)
// We skip snapshots where pushedBy === SESSION_ID
const localPushTimestamps = new Set();

// Active push promise tracker to prevent pulling stale state while pushing
let inFlightPushPromise = null;

const KEYS = {
  JOBS: 'blp_jobs_v2',
  JOB_ITEMS: 'blp_job_items_v2',
  CATALOG: 'blp_catalog_v2',
  CONSUMABLES: 'blp_consumables_v2',
  AUDIT_LOGS: 'blp_audit_logs_v2',
  DELETED_JOB_ITEMS: 'blp_deleted_job_items_v2',
  DELETED_JOBS: 'blp_deleted_jobs_v2',
  DELETED_CATALOG: 'blp_deleted_catalog_v2',
};

const getStoredArray = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const isItemTombstoned = (item, tombstonedJobItemSet, tombstonedJobSet) => {
  if (!item) return true;
  if (item.jobId && tombstonedJobSet.has(item.jobId)) return true;
  if (item.id && tombstonedJobItemSet.has(String(item.id))) return true;
  if (item.jobId && item.catalogId && tombstonedJobItemSet.has(`${item.jobId}_cat_${item.catalogId}`)) return true;
  if (item.jobId && item.name) {
    const rawName = String(item.name).trim();
    const lowerName = rawName.toLowerCase();
    if (tombstonedJobItemSet.has(`${item.jobId}_name_${lowerName}`)) return true;
    if (tombstonedJobItemSet.has(`${item.jobId}_${lowerName}`)) return true;
    if (tombstonedJobItemSet.has(`${item.jobId}_${rawName}`)) return true;
    if (tombstonedJobItemSet.has(`${item.jobId}_name_${rawName}`)) return true;
  }
  return false;
};

const writeLocalCache = (data) => {
  if (!data) return false;

  // 1. Merge Tombstones first
  const localDeletedJobItems = new Set(getStoredArray(KEYS.DELETED_JOB_ITEMS));
  if (Array.isArray(data.deletedJobItemIds)) {
    data.deletedJobItemIds.forEach(id => localDeletedJobItems.add(String(id)));
  }
  const mergedDeletedJobItems = [...localDeletedJobItems].slice(-500);
  localStorage.setItem(KEYS.DELETED_JOB_ITEMS, JSON.stringify(mergedDeletedJobItems));
  const tombstonedJobItemSet = new Set(mergedDeletedJobItems);

  const localDeletedJobs = new Set(getStoredArray(KEYS.DELETED_JOBS));
  if (Array.isArray(data.deletedJobIds)) {
    data.deletedJobIds.forEach(id => localDeletedJobs.add(String(id)));
  }
  const mergedDeletedJobs = [...localDeletedJobs].slice(-200);
  localStorage.setItem(KEYS.DELETED_JOBS, JSON.stringify(mergedDeletedJobs));
  const tombstonedJobSet = new Set(mergedDeletedJobs);

  const localDeletedCatalog = new Set(getStoredArray(KEYS.DELETED_CATALOG));
  if (Array.isArray(data.deletedCatalogIds)) {
    data.deletedCatalogIds.forEach(id => localDeletedCatalog.add(String(id)));
  }
  const mergedDeletedCatalog = [...localDeletedCatalog].slice(-200);
  localStorage.setItem(KEYS.DELETED_CATALOG, JSON.stringify(mergedDeletedCatalog));
  const tombstonedCatalogSet = new Set(mergedDeletedCatalog);

  // 2. Merge Jobs
  if (Array.isArray(data.jobs)) {
    const localJobs = getStoredArray(KEYS.JOBS);
    const jobMap = new Map();

    localJobs.forEach(job => {
      if (job && job.id && !tombstonedJobSet.has(job.id)) {
        jobMap.set(job.id, job);
      }
    });

    data.jobs.forEach(remoteJob => {
      if (!remoteJob || !remoteJob.id || tombstonedJobSet.has(remoteJob.id)) {
        return;
      }
      const existingLocal = jobMap.get(remoteJob.id);
      if (!existingLocal) {
        jobMap.set(remoteJob.id, remoteJob);
      } else {
        // Critical: If local is ARCHIVED, NEVER revert to ACTIVE unless remote is explicitly newer from another device
        if (existingLocal.status === 'ARCHIVED' && remoteJob.status !== 'ARCHIVED') {
          const localTime = existingLocal.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;
          const remoteTime = remoteJob.updatedAt ? new Date(remoteJob.updatedAt).getTime() : 0;
          if (remoteTime <= localTime) {
            return; // Keep local ARCHIVED!
          }
        }

        // If remote is ARCHIVED and local is not, remote ARCHIVED always wins
        if (remoteJob.status === 'ARCHIVED' && existingLocal.status !== 'ARCHIVED') {
          jobMap.set(remoteJob.id, remoteJob);
          return;
        }

        const localTime = existingLocal.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;
        const remoteTime = remoteJob.updatedAt ? new Date(remoteJob.updatedAt).getTime() : 0;

        if (remoteTime > localTime) {
          jobMap.set(remoteJob.id, remoteJob);
        } else if (remoteTime === localTime && remoteJob.status === 'ARCHIVED') {
          jobMap.set(remoteJob.id, remoteJob);
        }
      }
    });

    const finalJobs = Array.from(jobMap.values());
    localStorage.setItem(KEYS.JOBS, JSON.stringify(finalJobs));
  }

  // 3. Merge Job Items
  if (Array.isArray(data.jobItems)) {
    const localItems = getStoredArray(KEYS.JOB_ITEMS);
    const itemMap = new Map();

    const getItemKey = (item) => item.id || `${item.jobId}_${(item.name || '').toLowerCase().trim()}`;

    localItems.forEach(item => {
      if (!item) return;
      if (!isItemTombstoned(item, tombstonedJobItemSet, tombstonedJobSet)) {
        itemMap.set(getItemKey(item), item);
      }
    });

    data.jobItems.forEach(remoteItem => {
      if (!remoteItem) return;
      if (isItemTombstoned(remoteItem, tombstonedJobItemSet, tombstonedJobSet)) return;

      const key = getItemKey(remoteItem);
      const existingLocal = itemMap.get(key);

      if (!existingLocal) {
        itemMap.set(key, remoteItem);
      } else {
        const localTime = existingLocal.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;
        const remoteTime = remoteItem.updatedAt ? new Date(remoteItem.updatedAt).getTime() : 0;

        if (remoteTime >= localTime) {
          itemMap.set(key, remoteItem);
        }
      }
    });

    const finalItems = Array.from(itemMap.values());
    localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(finalItems));
  }

  // 4. Merge Catalog
  if (Array.isArray(data.catalog)) {
    const localCatalog = getStoredArray(KEYS.CATALOG);
    const catMap = new Map();

    localCatalog.forEach(c => {
      if (c && c.id && !tombstonedCatalogSet.has(c.id)) {
        catMap.set(c.id, c);
      }
    });

    data.catalog.forEach(remoteCat => {
      if (remoteCat && remoteCat.id && !tombstonedCatalogSet.has(remoteCat.id)) {
        catMap.set(remoteCat.id, remoteCat);
      }
    });

    let finalCat = Array.from(catMap.values());
    if (finalCat.length === 0 && !localStorage.getItem(KEYS.CATALOG)) {
      finalCat = INITIAL_CATALOG.filter(c => !tombstonedCatalogSet.has(c.id));
    }
    localStorage.setItem(KEYS.CATALOG, JSON.stringify(finalCat));
  }

  // 5. Consumables
  if (Array.isArray(data.consumables)) {
    localStorage.setItem(KEYS.CONSUMABLES, JSON.stringify(data.consumables));
  }

  // 6. Audit Logs
  if (Array.isArray(data.auditLogs)) {
    const localLogs = getStoredArray(KEYS.AUDIT_LOGS);
    const logMap = new Map();
    localLogs.forEach(l => { if (l && l.id) logMap.set(l.id, l); });
    data.auditLogs.forEach(l => { if (l && l.id) logMap.set(l.id, l); });
    const mergedLogs = Array.from(logMap.values())
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 300);
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(mergedLogs));
  }

  return true;
};

export const firebaseDb = {
  /**
   * Pushes full application payload to Cloud Firestore.
   * Tags the document with this session's ID so the listener can ignore its own echo.
   */
  async pushPayload(payload) {
    const pushTask = (async () => {
      try {
        const updatedAt = new Date().toISOString();
        const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);

        // Register this timestamp as ours BEFORE the push (in case snapshot arrives fast)
        localPushTimestamps.add(updatedAt);
        // Clean up old timestamps after 8 seconds to avoid memory leak
        setTimeout(() => localPushTimestamps.delete(updatedAt), 8000);

        const catalogToPush = Array.isArray(payload.catalog) ? payload.catalog : [];

        await setDoc(mainRef, {
          updatedAt,
          pushedBy: SESSION_ID,        // ← identifies the source device/session
          version: '3.1',
          jobs: payload.jobs || [],
          jobItems: payload.jobItems || [],
          catalog: catalogToPush,
          consumables: payload.consumables || [],
          auditLogs: payload.auditLogs || [],
          deletedJobItemIds: payload.deletedJobItemIds || [],
          deletedJobIds: payload.deletedJobIds || [],
          deletedCatalogIds: payload.deletedCatalogIds || [],
        }, { merge: true });

        console.log('[FirebaseDb] ✅ Push OK:', updatedAt, '| session:', SESSION_ID.slice(0, 16));
        return { success: true };
      } catch (err) {
        console.error('[FirebaseDb] ❌ Push ERROR:', err.message);
        return { success: false, error: err.message };
      } finally {
        if (inFlightPushPromise === pushTask) {
          inFlightPushPromise = null;
        }
      }
    })();

    inFlightPushPromise = pushTask;
    return await pushTask;
  },

  /**
   * Returns true if a push is currently in progress.
   */
  isPushInProgress() {
    return inFlightPushPromise !== null;
  },

  /**
   * Directly pulls latest payload from Cloud Firestore (one-shot read).
   * Used on app startup and on visibility change.
   * If a push is in progress, awaits it first to avoid pulling pre-mutation state.
   */
  async pullFromCloud() {
    try {
      if (inFlightPushPromise) {
        console.log('[FirebaseDb] Pull waiting for in-flight push to complete...');
        await inFlightPushPromise;
      }

      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      const snap = await getDoc(mainRef);
      if (snap.exists()) {
        const data = snap.data();
        writeLocalCache(data);
        console.log('[FirebaseDb] ✅ Pull OK:', data.updatedAt, '| from:', data.pushedBy?.slice(0, 16));
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
