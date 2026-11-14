// Shared test helpers: seed localStorage with fixtures and simulate several devices
// by snapshotting / restoring the whole localStorage of one "device".

export const KEYS = {
  JOBS: 'blp_jobs_v2',
  JOB_ITEMS: 'blp_job_items_v2',
  VEHICLES: 'blp_vehicles_v2',
  CONSUMABLES: 'blp_consumables_v2',
  AUDIT_LOGS: 'blp_audit_logs_v2',
  CATALOG: 'blp_catalog_v2',
  CURRENT_JOB_ID: 'blp_current_job_id_v2',
  DELETED_JOB_ITEMS: 'blp_deleted_job_items_v2',
  DELETED_JOBS: 'blp_deleted_jobs_v2',
  DELETED_CATALOG: 'blp_deleted_catalog_v2',
};

export const T0 = '2026-11-01T10:00:00.000Z';

export const makeJob = (overrides = {}) => ({
  id: 'job-1',
  name: 'Reklama Test',
  client: 'Produkce',
  status: 'ACTIVE',
  mode: 'LOADING',
  vehicleIds: ['v1'],
  updatedAt: T0,
  ...overrides,
});

export const makeItem = (overrides = {}) => ({
  id: 'ji-1',
  jobId: 'job-1',
  catalogId: 'cat-sky',
  name: 'SkyPanel S60-C',
  category: 'Lights',
  assignedVehicleId: 'v1',
  quantityRequested: 4,
  quantityLoaded: 0,
  status: 'PENDING',
  serialNumber: 'SKY-100',
  damageNotes: '',
  photoUrls: [],
  updatedAt: T0,
  ...overrides,
});

export const makeCatalogItem = (overrides = {}) => ({
  id: 'cat-sky',
  name: 'SkyPanel S60-C',
  category: 'Lights',
  serialPrefix: 'SKY',
  image: '',
  availableCount: 10,
  isBundle: false,
  bundleItems: [],
  ...overrides,
});

export function seedLocal({ jobs = [], items = [], catalog = [], consumables = [], auditLogs = [], currentJobId } = {}) {
  localStorage.clear();
  localStorage.setItem('blp_data_version_v5', '5.0');
  localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
  localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(items));
  localStorage.setItem(KEYS.CATALOG, JSON.stringify(catalog));
  localStorage.setItem(KEYS.CONSUMABLES, JSON.stringify(consumables));
  localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  localStorage.setItem(KEYS.CURRENT_JOB_ID, currentJobId || jobs[0]?.id || '');
}

export const readLocal = (key) => JSON.parse(localStorage.getItem(key) || '[]');

/** Returns a plain copy of the current localStorage (one "device"). */
export function snapshotDevice() {
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    snap[k] = localStorage.getItem(k);
  }
  return snap;
}

/** Replaces localStorage with a previously captured device snapshot. */
export function switchToDevice(snap) {
  localStorage.clear();
  Object.entries(snap).forEach(([k, v]) => localStorage.setItem(k, v));
}

/** Builds a Firestore-like snapshot object for a mocked getDoc(). */
export const docSnapshot = (data) => ({
  exists: () => true,
  data: () => data,
  metadata: { hasPendingWrites: false },
});
