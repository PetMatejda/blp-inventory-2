import {
  db,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
} from './firebase';

const GLOBAL_STORE_DOC_ID = 'blp_main_store';

// Track the last server timestamp we received to prevent applying stale data
let lastServerUpdatedAt = null;
// Track if we are the one pushing so we can skip our own echo
let isPushing = false;

export const firebaseDb = {
  /**
   * Pushes full application payload to Cloud Firestore
   */
  async pushPayload(payload) {
    try {
      isPushing = true;
      const updatedAt = new Date().toISOString();
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      await setDoc(mainRef, {
        updatedAt,
        jobs: payload.jobs || [],
        jobItems: payload.jobItems || [],
        catalog: payload.catalog || [],
        consumables: payload.consumables || [],
        auditLogs: payload.auditLogs || [],
      }, { merge: true });

      lastServerUpdatedAt = updatedAt;
      console.log('[FirebaseDb] Data úspěšně nahrána do cloudu Firestore:', updatedAt);
      return { success: true };
    } catch (err) {
      console.error('[FirebaseDb] Firestore push ERROR (Zkontrolujte pravidla Firestore v konzoli):', err.message);
      return { success: false, error: err.message };
    } finally {
      // Allow next incoming snapshot to be processed after a brief delay
      setTimeout(() => { isPushing = false; }, 300);
    }
  },

  /**
   * Directly pulls latest payload from Cloud Firestore
   */
  async pullFromCloud() {
    try {
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      const snap = await getDoc(mainRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.jobs) localStorage.setItem('blp_jobs_v2', JSON.stringify(data.jobs));
        if (data.jobItems) localStorage.setItem('blp_job_items_v2', JSON.stringify(data.jobItems));
        if (data.catalog) localStorage.setItem('blp_catalog_v2', JSON.stringify(data.catalog));
        if (data.consumables) localStorage.setItem('blp_consumables_v2', JSON.stringify(data.consumables));
        if (data.auditLogs) localStorage.setItem('blp_audit_logs_v2', JSON.stringify(data.auditLogs));
        lastServerUpdatedAt = data.updatedAt;
        console.log('[FirebaseDb] Data stažena z cloudu Firestore:', data.updatedAt);
        return { success: true, data };
      }
      return { success: false, error: 'Dokument v cloudu neexistuje.' };
    } catch (err) {
      console.error('[FirebaseDb] Firestore pull error:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Subscribes to Realtime Firestore Database updates (<100ms sync across devices)
   * Only triggers onUpdate when the change originates from ANOTHER device/session.
   */
  subscribeToCloud(onUpdate) {
    try {
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      const unsubscribe = onSnapshot(mainRef, { includeMetadataChanges: true }, (snap) => {
        if (!snap.exists()) return;

        // Skip local pending writes — wait for server confirmation only
        if (snap.metadata.hasPendingWrites) return;

        // Skip if the snapshot came from our own push (echo prevention)
        if (isPushing) return;

        const data = snap.data();

        // Only apply remote updates that are newer than what we last pushed/received
        if (lastServerUpdatedAt && data.updatedAt <= lastServerUpdatedAt) {
          console.log('[FirebaseDb] Skipping stale/own snapshot:', data.updatedAt);
          return;
        }

        console.log('[FirebaseDb] Realtime remote cloud aktualizace od jiného zařízení:', data.updatedAt);
        lastServerUpdatedAt = data.updatedAt;

        // Update local cache with real cloud data
        if (data.jobs) localStorage.setItem('blp_jobs_v2', JSON.stringify(data.jobs));
        if (data.jobItems) localStorage.setItem('blp_job_items_v2', JSON.stringify(data.jobItems));
        if (data.catalog) localStorage.setItem('blp_catalog_v2', JSON.stringify(data.catalog));
        if (data.consumables) localStorage.setItem('blp_consumables_v2', JSON.stringify(data.consumables));
        if (data.auditLogs) localStorage.setItem('blp_audit_logs_v2', JSON.stringify(data.auditLogs));

        if (onUpdate) onUpdate(data);
      }, (err) => {
        console.warn('[FirebaseDb] Firestore listener notice (pravidla/offline):', err.message);
      });

      return unsubscribe;
    } catch (err) {
      console.warn('[FirebaseDb] Firestore subscribe notice:', err.message);
      return () => {};
    }
  }
};
