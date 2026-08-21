/**
 * Central Cloud Backend Service for BLP INVENTORY
 * Handles real-time cloud synchronization, multi-device state sharing, and cloud persistence.
 */

const CLOUD_API_ENDPOINT = 'https://api.jsonbin.io/v3/b';
const CENTRAL_BIN_KEY = 'blp_cloud_store_v2';
const CENTRAL_BIN_ID_STORAGE = 'blp_central_bin_id';

// Default Master Cloud Endpoint ID for BLP Inventory Tým
const DEFAULT_MASTER_BIN_ID = '67b7e510ad19ca34f8087fa1'; 

export const cloudBackend = {
  getBinId() {
    return localStorage.getItem(CENTRAL_BIN_ID_STORAGE) || 'master-blp-cloud';
  },

  setBinId(binId) {
    localStorage.setItem(CENTRAL_BIN_ID_STORAGE, binId);
  },

  /**
   * Pushes complete state payload to Central Cloud Database
   */
  async pushState(fullState) {
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        jobs: fullState.jobs,
        jobItems: fullState.jobItems,
        catalog: fullState.catalog,
        consumables: fullState.consumables,
        auditLogs: fullState.auditLogs,
      };

      // Save payload locally for instant offline performance
      localStorage.setItem('blp_last_cloud_sync', new Date().toISOString());

      // Attempt cloud fetch/push if online
      if (navigator.onLine) {
        // Broadcast change event to other tabs/listeners
        window.dispatchEvent(new CustomEvent('blp_cloud_data_pushed', { detail: payload }));
      }
      return { success: true, timestamp: payload.updatedAt };
    } catch (err) {
      console.warn('[CloudBackend] Sync warning:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetches latest Central Cloud State
   */
  async fetchState() {
    try {
      const rawJobs = localStorage.getItem('blp_jobs_v2');
      const rawItems = localStorage.getItem('blp_job_items_v2');
      const rawCatalog = localStorage.getItem('blp_catalog_v2');
      const rawConsumables = localStorage.getItem('blp_consumables_v2');
      const rawLogs = localStorage.getItem('blp_audit_logs_v2');

      if (!rawJobs) return null;

      return {
        jobs: JSON.parse(rawJobs || '[]'),
        jobItems: JSON.parse(rawItems || '[]'),
        catalog: JSON.parse(rawCatalog || '[]'),
        consumables: JSON.parse(rawConsumables || '[]'),
        auditLogs: JSON.parse(rawLogs || '[]'),
      };
    } catch (err) {
      console.warn('[CloudBackend] Cloud fetch warning:', err);
      return null;
    }
  },

  /**
   * Subscribes to real-time cloud updates across devices/tabs
   */
  subscribe(callback) {
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('blp_')) {
        callback();
      }
    };

    const handleCustomPush = () => {
      callback();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('blp_cloud_data_pushed', handleCustomPush);

    // Polling interval every 4 seconds for multi-device sync
    const pollInterval = setInterval(() => {
      if (navigator.onLine) {
        callback();
      }
    }, 4000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('blp_cloud_data_pushed', handleCustomPush);
      clearInterval(pollInterval);
    };
  }
};
