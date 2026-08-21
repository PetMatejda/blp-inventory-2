import {
  db,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
} from './firebase';

const GLOBAL_STORE_DOC_ID = 'blp_main_store';

export const firebaseDb = {
  /**
   * Pushes full application payload to Cloud Firestore
   */
  async pushPayload(payload) {
    try {
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      await setDoc(mainRef, {
        updatedAt: new Date().toISOString(),
        jobs: payload.jobs || [],
        jobItems: payload.jobItems || [],
        catalog: payload.catalog || [],
        consumables: payload.consumables || [],
        auditLogs: payload.auditLogs || [],
      }, { merge: true });

      console.log('[FirebaseDb] Data úspěšně nahrána do cloudu Firestore:', payload.updatedAt);
      return { success: true };
    } catch (err) {
      console.error('[FirebaseDb] Firestore push ERROR (Zkontrolujte pravidla Firestore v konzoli):', err.message);
      return { success: false, error: err.message };
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
   */
  subscribeToCloud(onUpdate) {
    try {
      const mainRef = doc(db, 'inventory_store', GLOBAL_STORE_DOC_ID);
      const unsubscribe = onSnapshot(mainRef, { includeMetadataChanges: true }, (snap) => {
        if (snap.exists()) {
          // Ignore local pending writes so we only react to true server confirmations & remote updates
          if (snap.metadata.hasPendingWrites) {
            return;
          }

          const data = snap.data();
          console.log('[FirebaseDb] Realtime server cloud aktualizace přijata:', data.updatedAt);

          // Update local cache with real cloud data
          if (data.jobs) localStorage.setItem('blp_jobs_v2', JSON.stringify(data.jobs));
          if (data.jobItems) localStorage.setItem('blp_job_items_v2', JSON.stringify(data.jobItems));
          if (data.catalog) localStorage.setItem('blp_catalog_v2', JSON.stringify(data.catalog));
          if (data.consumables) localStorage.setItem('blp_consumables_v2', JSON.stringify(data.consumables));
          if (data.auditLogs) localStorage.setItem('blp_audit_logs_v2', JSON.stringify(data.auditLogs));

          if (onUpdate) onUpdate(data);
        }
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
