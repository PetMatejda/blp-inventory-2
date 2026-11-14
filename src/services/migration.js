// One-time migration from the legacy single document
//   /inventory_store/blp_main_store  { jobs[], jobItems[], catalog[], consumables[], auditLogs[], deleted*Ids[] }
// to one Firestore document per record in the collections below.
// The legacy document is only READ — it stays untouched as a backup.

import { indexTombstones, isItemTombstoned } from './tombstones.js';

export const LEGACY_DOC = ['inventory_store', 'blp_main_store'];
export const MIGRATION_DOC = ['meta', 'migration_v3'];
export const AUDIT_LIMIT = 300;
const BATCH_SIZE = 400; // Firestore allows 500 writes per batch

/** Firestore rejects `undefined`; JSON round-trip drops those fields. */
const clean = (obj) => JSON.parse(JSON.stringify(obj));
const normName = (name) => String(name || '').toLowerCase().trim();

/** Merges duplicate records of the same equipment within a job (legacy data could hold several). */
function consolidateItems(items) {
  const map = new Map();
  const result = [];
  for (const item of items) {
    const key = item.catalogId
      ? `${item.jobId}_cat_${item.catalogId}_${normName(item.name)}`
      : `${item.jobId}_name_${normName(item.name)}`;
    const existing = map.get(key);
    if (!existing) {
      const copy = { ...item };
      map.set(key, copy);
      result.push(copy);
      continue;
    }
    existing.quantityRequested = (existing.quantityRequested || 0) + (item.quantityRequested || 0);
    existing.quantityLoaded = (existing.quantityLoaded || 0) + (item.quantityLoaded || 0);
    if (item.serialNumber && !(existing.serialNumber || '').includes(item.serialNumber)) {
      existing.serialNumber = existing.serialNumber ? `${existing.serialNumber}, ${item.serialNumber}` : item.serialNumber;
    }
    if (item.updatedAt && (!existing.updatedAt || item.updatedAt > existing.updatedAt)) {
      existing.updatedAt = item.updatedAt;
      existing.status = item.status;
    }
    if (existing.quantityRequested > 0 && existing.quantityLoaded >= existing.quantityRequested) {
      existing.status = existing.status === 'PACKED' ? 'PACKED' : 'LOADED';
    } else if (existing.status !== 'DAMAGED') {
      existing.status = 'PENDING';
    }
  }
  return result;
}

/**
 * Turns the legacy document into clean records per collection.
 * Applies deletions (tombstones), merges duplicates, gives every record an ID.
 */
export function buildMigrationPlan(legacy = {}) {
  const deletedJobIds = new Set((legacy.deletedJobIds || []).map(String));
  const deletedCatalogIds = new Set((legacy.deletedCatalogIds || []).map(String));
  const tombstones = indexTombstones(legacy.deletedJobItemIds || []);

  const jobs = (legacy.jobs || [])
    .filter((j) => j && j.id && !deletedJobIds.has(String(j.id)))
    .map((j) => clean({ status: 'ACTIVE', mode: 'LOADING', ...j, id: String(j.id) }));
  const jobIds = new Set(jobs.map((j) => j.id));

  const liveItems = (legacy.jobItems || [])
    .filter((i) => i && i.name && i.jobId && jobIds.has(i.jobId))
    .filter((i) => !isItemTombstoned(i, tombstones, deletedJobIds));
  const usedItemIds = new Set();
  const jobItems = consolidateItems(liveItems).map((i, idx) => {
    let id = i.id ? String(i.id) : `legacy-item-${idx}`;
    while (usedItemIds.has(id)) id = `${id}-dup`;
    usedItemIds.add(id);
    return clean({ ...i, id });
  });

  const catalog = (legacy.catalog || [])
    .filter((c) => c && c.id && !deletedCatalogIds.has(String(c.id)))
    .map((c) => clean({ ...c, id: String(c.id) }));

  const consumables = (legacy.consumables || [])
    .filter((c) => c && c.id)
    .map((c) => clean({ ...c, id: String(c.id) }));

  const usedLogIds = new Set();
  const auditLogs = [...(legacy.auditLogs || [])]
    .filter((l) => l && l.timestamp)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, AUDIT_LIMIT)
    .map((l, idx) => {
      let id = l.id ? String(l.id) : `legacy-log-${idx}`;
      while (usedLogIds.has(id)) id = `${id}-${idx}`;
      usedLogIds.add(id);
      return clean({ ...l, id });
    });

  return { jobs, jobItems, catalog, consumables, auditLogs };
}

/**
 * Repairs an empty or incomplete catalog: copies catalog items from the legacy
 * document (backup); when that has none, uses the built-in default catalog.
 * Never overwrites items that already exist. Returns { count, source }.
 */
export async function restoreCatalog(fs, { existingIds = [], defaults = [], collection = 'catalog', jobItems = [] } = {}) {
  const { db, doc, getDoc, writeBatch } = fs;
  const existing = new Set(existingIds.map(String));
  let source = 'legacy';
  let items = [];
  const legacySnap = await getDoc(doc(db, ...LEGACY_DOC));
  if (legacySnap.exists()) items = buildMigrationPlan(legacySnap.data())[collection] || [];
  if (!items.length) {
    source = 'default';
    items = defaults.filter((c) => c && c.id).map((c) => clean({ ...c, id: String(c.id) }));
  }
  // Equipment used on jobs whose catalog entry is missing everywhere is rebuilt from the job lines.
  const derived = collection === 'catalog' ? catalogFromJobItems(jobItems, new Set([...existing, ...items.map((c) => c.id)])) : [];
  items = [...items, ...derived];
  const missing = items.filter((c) => !existing.has(c.id));
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const c of missing.slice(i, i + BATCH_SIZE)) batch.set(doc(db, collection, c.id), c);
    await batch.commit();
  }
  return { count: missing.length, source, available: items.length, fromJobs: derived.filter((c) => !existing.has(c.id)).length };
}

/**
 * Catalog entries rebuilt from job lines that point to a catalog id nobody has.
 * Available count = the largest quantity ever requested (to be checked by a stocktake).
 */
export function catalogFromJobItems(jobItems, knownIds = new Set()) {
  const byId = new Map();
  for (const i of jobItems) {
    if (!i?.catalogId || knownIds.has(i.catalogId)) continue;
    const prev = byId.get(i.catalogId);
    const image = (i.photoUrls || []).find((u) => typeof u === 'string' && /^https?:/.test(u)) || '';
    const prefix = String(i.serialNumber || '').split(/[,\s]/)[0].replace(/-\d+$/, '') || 'EQP';
    byId.set(i.catalogId, {
      id: i.catalogId,
      name: (prev?.name || i.name || '').replace(/\s*\(Ad-Hoc\)$/, ''),
      category: prev?.category || i.category || 'Lights',
      image: prev?.image || image,
      serialPrefix: prev?.serialPrefix || prefix,
      barcode: prev?.barcode || i.barcode || '',
      availableCount: Math.max(prev?.availableCount || 0, i.quantityRequested || 0),
      isBundle: false,
      bundleItems: [],
      restoredFromJobs: true,
    });
  }
  return [...byId.values()].map(clean);
}

/**
 * Runs the migration once for the whole team. Safe to call on every start:
 * a marker document makes later calls (and parallel devices) skip it.
 * `fs` is the Firestore API object (injected so tests can use a fake).
 * Returns { status: 'done' | 'skipped' | 'empty', counts? }.
 */
export async function migrateLegacyStore(fs, { user = 'system' } = {}) {
  const { db, doc, getDoc, runTransaction, writeBatch } = fs;
  const markerRef = doc(db, ...MIGRATION_DOC);

  // Claim the migration (only one device does the work).
  const claimed = await runTransaction(db, async (tx) => {
    const marker = await tx.get(markerRef);
    if (marker.exists()) {
      const m = marker.data();
      const startedMs = m.startedAt ? new Date(m.startedAt).getTime() : 0;
      const stale = m.status === 'running' && Date.now() - startedMs > 10 * 60 * 1000;
      if (!stale) return false;
    }
    tx.set(markerRef, { status: 'running', startedAt: new Date().toISOString(), by: user });
    return true;
  });
  if (!claimed) return { status: 'skipped' };

  const legacySnap = await getDoc(doc(db, ...LEGACY_DOC));
  if (!legacySnap.exists()) {
    await writeBatch(db).set(markerRef, { status: 'done', finishedAt: new Date().toISOString(), by: user, empty: true }).commit();
    return { status: 'empty' };
  }

  const plan = buildMigrationPlan(legacySnap.data());
  const writes = [];
  for (const [col, records] of Object.entries(plan)) {
    for (const record of records) writes.push([col, record]);
  }
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const [col, record] of writes.slice(i, i + BATCH_SIZE)) {
      batch.set(doc(db, col, record.id), record);
    }
    await batch.commit();
  }

  const counts = Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v.length]));
  await writeBatch(db).set(markerRef, { status: 'done', finishedAt: new Date().toISOString(), by: user, counts }).commit();
  return { status: 'done', counts };
}
