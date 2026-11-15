// Business rules for job items (FUNKCNI_SPECIFIKACE.md, section 4).
// Pure functions: they take the current item and return the changed fields.
// No storage, no Firebase — the data layer decides how to persist the result.

export const MODES = { LOADING: 'LOADING', DERIGGING: 'DERIGGING', RESTOCK: 'RESTOCK' };

const DONE = { LOADING: 'LOADED', DERIGGING: 'PACKED', RESTOCK: 'RESTOCKED' };
const doneStatus = (mode) => DONE[mode] || 'LOADED';

/**
 * Entering the restock phase. What was packed in derigging is prefilled as
 * restocked (the crew only fixes differences instead of counting everything
 * a second time). Items not packed start at 0; labelled units (unitIds) must be
 * scanned back one by one, so they start at 0 too. Damaged items keep their
 * state (→ service).
 */
export function enterRestock(item) {
  if (item.status === 'DAMAGED') return {};
  const packed = item.status === 'PACKED' && (item.quantityLoaded || 0) > 0 && !item.unitIds?.length;
  if (packed) return { quantityLoaded: Math.min(item.quantityLoaded, item.quantityRequested || item.quantityLoaded), status: 'RESTOCKED' };
  return { quantityLoaded: 0, status: 'PENDING' };
}
const normName = (name) => String(name || '').toLowerCase().trim();

/** +/- stepper. Never below 0; counting past the plan raises the plan (current behaviour). */
export function applyQuantityDelta(item, delta, mode = MODES.LOADING) {
  const loaded = Math.max(0, (item.quantityLoaded || 0) + delta);
  const requested = Math.max(item.quantityRequested || 0, loaded);
  let status = item.status;
  if (loaded === requested && loaded > 0) status = doneStatus(mode);
  else if (loaded < requested) status = 'PENDING';
  return { quantityLoaded: loaded, quantityRequested: requested, status };
}

/** Set an exact counted quantity (manual entry). */
export function applyExactQuantity(item, exact, mode = MODES.LOADING) {
  const target = Math.max(0, Math.floor(Number(exact) || 0));
  return applyQuantityDelta(item, target - (item.quantityLoaded || 0), mode);
}

/**
 * Planned quantity (preparation before loading). The counted quantity never
 * exceeds the plan; a damaged item stays damaged.
 */
export function applyRequestedQuantity(item, requested, mode = MODES.LOADING) {
  const plan = Math.max(1, Math.floor(Number(requested) || 0));
  const loaded = Math.min(item.quantityLoaded || 0, plan);
  if (item.status === 'DAMAGED') return { quantityRequested: plan, quantityLoaded: loaded };
  const status = loaded > 0 && loaded >= plan ? doneStatus(mode) : 'PENDING';
  return { quantityRequested: plan, quantityLoaded: loaded, status };
}

/**
 * Damage photos of an item. Catalog pictures used to be copied into photoUrls;
 * those are left out (catalog items no longer have photos), only photos taken
 * in the app while reporting damage count.
 */
export function damagePhotos(item, catalogImage = '') {
  if (!item || item.status !== 'DAMAGED') return [];
  return [...new Set((item.photoUrls || []).filter((p) =>
    typeof p === 'string' && p.startsWith('photo:') && p !== catalogImage && p !== item.image))];
}

/** Swipe right: full quantity loaded (rigging) or packed (derigging). */
export function markDone(item, mode = MODES.LOADING) {
  return { quantityLoaded: item.quantityRequested || 0, status: doneStatus(mode) };
}

/** Swipe left: back to "to load" (rigging) or back "on set" (derigging). */
export function markUndone(item, mode = MODES.LOADING) {
  if (mode === MODES.RESTOCK) return { quantityLoaded: 0, status: 'PENDING' };
  return mode === MODES.DERIGGING
    ? { quantityLoaded: item.quantityRequested || 0, status: 'LOADED' }
    : { quantityLoaded: 0, status: 'PENDING' };
}

/**
 * Status toggle. From DAMAGED it clears the damage (spec 4.2 rule 4): the counted
 * quantity stays and the item is done only if the full quantity is present.
 */
export function toggleStatus(item, mode = MODES.LOADING) {
  if (item.status === 'LOADED' || item.status === 'PACKED' || item.status === 'RESTOCKED') {
    return { quantityLoaded: 0, status: 'PENDING' };
  }
  if (item.status === 'DAMAGED') {
    const complete = (item.quantityRequested || 0) > 0 && (item.quantityLoaded || 0) >= item.quantityRequested;
    return {
      status: complete ? doneStatus(mode) : 'PENDING',
      damageNotes: '',
      damageSeverity: null,
      photoUrls: [],
    };
  }
  return { quantityLoaded: item.quantityRequested || 0, status: doneStatus(mode) };
}

export function reportDamage(item, severity, notes, photoUrl) {
  return {
    status: 'DAMAGED',
    damageSeverity: severity,
    damageNotes: notes || '',
    photoUrls: photoUrl ? [...(item.photoUrls || []), photoUrl] : (item.photoUrls || []),
  };
}

/** Finds an item of the job that represents the same equipment. */
export function findSameEquipment(jobItems, jobId, { catalogId, name }) {
  return jobItems.find((i) => i.jobId === jobId && (
    (catalogId && i.catalogId === catalogId) || normName(i.name) === normName(name)
  ));
}

const randomSerial = (prefix) => `${prefix || 'EQP'}-${Math.floor(100 + Math.random() * 900)}`;

/** New job item created from a catalog entry (1 piece). */
export function newItemFromCatalog(jobId, catalogItem, vehicleId = '') {
  return {
    jobId,
    catalogId: catalogItem.id,
    name: catalogItem.name,
    category: catalogItem.category,
    icon: catalogItem.icon || '',
    assignedVehicleId: vehicleId,
    quantityRequested: 1,
    quantityLoaded: 0,
    status: 'PENDING',
    serialNumber: randomSerial(catalogItem.serialPrefix),
    barcode: catalogItem.barcode || '',
    isAdHoc: false,
    isBundle: false,
    damageNotes: '',
    photoUrls: [],
  };
}

/**
 * Expands a bundle (set) into separate job items.
 * Returns { updates: [{ item, patch }], creates: [newItem], summary: [string] }.
 */
export function expandBundle(jobId, bundle, jobItems, catalog, vehicleId = '') {
  const updates = [];
  const creates = [];
  const summary = [];
  for (const sub of bundle.bundleItems || []) {
    const qty = sub.qty || 1;
    const existing = findSameEquipment([...jobItems, ...creates], jobId, { name: sub.name });
    if (existing && !creates.includes(existing)) {
      updates.push({ item: existing, patch: { quantityRequested: (existing.quantityRequested || 0) + qty } });
      summary.push(`${sub.name} (+${qty} ks)`);
    } else if (existing) {
      existing.quantityRequested += qty;
      summary.push(`${sub.name} (+${qty} ks)`);
    } else {
      const match = catalog.find((c) => normName(c.name) === normName(sub.name));
      creates.push({
        jobId,
        catalogId: match ? match.id : null,
        name: sub.name,
        category: match ? match.category : (bundle.category || 'Lights'),
        assignedVehicleId: vehicleId,
        quantityRequested: qty,
        quantityLoaded: 0,
        status: 'PENDING',
        serialNumber: match ? randomSerial(match.serialPrefix) : randomSerial('SET'),
        bundleTag: `Doporučeno ze setu: ${bundle.name}`,
        isAdHoc: false,
        isBundle: false,
        damageNotes: '',
        photoUrls: [],
      });
      summary.push(`${sub.name} (${qty} ks)`);
    }
  }
  return { updates, creates, summary };
}

export const adHocName = (name) => `${String(name).trim()} (Ad-Hoc)`;

export function newAdHocItem(jobId, name, category, quantity, vehicleId = '') {
  return {
    jobId,
    catalogId: null,
    name: adHocName(name),
    category: category || 'Grip',
    assignedVehicleId: vehicleId,
    quantityRequested: Math.max(1, parseInt(quantity, 10) || 1),
    quantityLoaded: 0,
    status: 'PENDING',
    serialNumber: 'ADHOC-' + Math.floor(1000 + Math.random() * 9000),
    isAdHoc: true,
    damageNotes: '',
    photoUrls: [],
  };
}

/** Items for a job created from a template: same equipment, nothing loaded yet. */
export function copyItemsForTemplate(sourceItems, newJobId) {
  return sourceItems.map(({ id, updatedAt, ...item }) => ({
    ...item,
    jobId: newJobId,
    quantityLoaded: 0,
    status: 'PENDING',
    damageNotes: '',
    damageSeverity: null,
    photoUrls: [],
  }));
}

/** Progress of a job by item rows (current behaviour). */
export function jobProgress(items, mode = MODES.LOADING) {
  const total = items.length;
  const done = items.filter((i) => i.status === doneStatus(mode)).length;
  return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}
