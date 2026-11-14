// Business rules for job items (FUNKCNI_SPECIFIKACE.md, section 4).
// Pure functions: they take the current item and return the changed fields.
// No storage, no Firebase — the data layer decides how to persist the result.

export const MODES = { LOADING: 'LOADING', DERIGGING: 'DERIGGING' };

const doneStatus = (mode) => (mode === MODES.DERIGGING ? 'PACKED' : 'LOADED');
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

/** Swipe right: full quantity loaded (rigging) or packed (derigging). */
export function markDone(item, mode = MODES.LOADING) {
  return { quantityLoaded: item.quantityRequested || 0, status: doneStatus(mode) };
}

/** Swipe left: back to "to load" (rigging) or back "on set" (derigging). */
export function markUndone(item, mode = MODES.LOADING) {
  return mode === MODES.DERIGGING
    ? { quantityLoaded: item.quantityRequested || 0, status: 'LOADED' }
    : { quantityLoaded: 0, status: 'PENDING' };
}

/**
 * Status toggle. From DAMAGED it clears the damage (spec 4.2 rule 4): the counted
 * quantity stays and the item is done only if the full quantity is present.
 */
export function toggleStatus(item, mode = MODES.LOADING) {
  if (item.status === 'LOADED' || item.status === 'PACKED') {
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
export function newItemFromCatalog(jobId, catalogItem, vehicleId = 'v1') {
  return {
    jobId,
    catalogId: catalogItem.id,
    name: catalogItem.name,
    category: catalogItem.category,
    assignedVehicleId: vehicleId,
    quantityRequested: 1,
    quantityLoaded: 0,
    status: 'PENDING',
    serialNumber: randomSerial(catalogItem.serialPrefix),
    barcode: catalogItem.barcode || '',
    isAdHoc: false,
    isBundle: false,
    damageNotes: '',
    photoUrls: catalogItem.image ? [catalogItem.image] : [],
  };
}

/**
 * Expands a bundle (set) into separate job items.
 * Returns { updates: [{ item, patch }], creates: [newItem], summary: [string] }.
 */
export function expandBundle(jobId, bundle, jobItems, catalog, vehicleId = 'v1') {
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
        photoUrls: match?.image ? [match.image] : (bundle.image ? [bundle.image] : []),
      });
      summary.push(`${sub.name} (${qty} ks)`);
    }
  }
  return { updates, creates, summary };
}

export const adHocName = (name) => `${String(name).trim()} (Ad-Hoc)`;

export function newAdHocItem(jobId, name, category, quantity, vehicleId = 'v1') {
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
