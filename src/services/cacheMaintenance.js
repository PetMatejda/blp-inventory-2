// Maintenance of data stored in this browser.
//
// Firestore keeps an offline copy of the data in IndexedDB. If that copy gets
// damaged (seen after many app versions / several open tabs), the page can hang
// or crash with "Out of Memory". Opening the app with ?reset-cache=1 deletes the
// local copy before Firebase starts; data in the cloud is not touched.
// Changes not yet sent to the cloud from this browser are lost by the reset.

export const RESET_PARAM = 'reset-cache';

/** IndexedDB databases that belong to the Firestore offline cache. */
export const isFirestoreCacheDb = (name) => typeof name === 'string' && name.startsWith('firestore/');

const deleteDb = (name) => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase(name);
  req.onsuccess = req.onerror = req.onblocked = () => resolve();
});

/** Deletes the Firestore offline cache of this browser. Returns the names deleted. */
export async function clearFirestoreCache() {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return [];
  const dbs = await indexedDB.databases();
  const names = dbs.map((d) => d.name).filter(isFirestoreCacheDb);
  await Promise.all(names.map(deleteDb));
  return names;
}

/** Runs the reset when the URL contains ?reset-cache=1, then removes the parameter. */
export async function resetLocalCacheIfRequested(location = window.location) {
  const url = new URL(location.href);
  if (!url.searchParams.has(RESET_PARAM)) return false;
  try {
    const names = await clearFirestoreCache();
    console.info('[Cache] Reset Firestore cache:', names);
    sessionStorage.setItem('blp_cache_reset', String(names.length));
  } catch (err) {
    console.warn('[Cache] Reset failed:', err);
  }
  url.searchParams.delete(RESET_PARAM);
  window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
  return true;
}

/** Keys of the pre-collections version (single shared document); no longer read. */
export const LEGACY_LOCAL_KEYS = [
  'blp_jobs_v2', 'blp_job_items_v2', 'blp_vehicles_v2', 'blp_consumables_v2', 'blp_audit_logs_v2',
  'blp_catalog_v2', 'blp_user_role_v2', 'blp_deleted_job_items_v2', 'blp_deleted_jobs_v2',
  'blp_deleted_catalog_v2', 'blp_data_version_v5',
];

export function removeLegacyLocalData(storage = window.localStorage) {
  try { LEGACY_LOCAL_KEYS.forEach((k) => storage.removeItem(k)); } catch { /* private mode */ }
}
