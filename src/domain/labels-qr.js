// Labels and scanned codes (phase 4b) — pure functions.
//
// Label payloads:
//   labelled unit (light, ballast) → its own code, e.g. "FL-001"
//   item tracked by count          → "BLP:<catalogId>" (for boxes / shelves)
// Existing EAN barcodes and serial numbers keep working when scanned.

export const CATALOG_PREFIX = 'BLP:';

export const catalogLabelPayload = (catalogItem) => `${CATALOG_PREFIX}${catalogItem.id}`;

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Next free unit codes for a catalog item: PREFIX-001, PREFIX-002 …
 * Skips codes that already exist (case-insensitive).
 */
export function nextUnitCodes(prefix, existingCodes, count) {
  const base = String(prefix || 'EQP').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'EQP';
  const taken = new Set(existingCodes.map(norm));
  const codes = [];
  for (let n = 1; codes.length < count && n < 100000; n++) {
    const code = `${base}-${String(n).padStart(3, '0')}`;
    if (!taken.has(norm(code))) codes.push(code);
  }
  return codes;
}

/**
 * What a scanned code means.
 * Returns one of:
 *   { kind: 'UNIT', unit, item? }        labelled unit (+ the job line for its catalog item)
 *   { kind: 'ITEM', item }               job line (EAN, serial number, catalog label)
 *   { kind: 'CATALOG', catalogItem }     known equipment that is not on the job yet
 *   { kind: 'UNKNOWN' }
 */
export function resolveCode(rawCode, { jobItems = [], catalog = [], units = [] }) {
  const code = norm(rawCode);
  if (!code) return { kind: 'UNKNOWN' };

  const unit = units.find((u) => norm(u.code) === code || (u.serialNumber && norm(u.serialNumber) === code));
  if (unit) {
    const item = jobItems.find((i) => i.catalogId === unit.catalogId);
    return { kind: 'UNIT', unit, item };
  }

  const catalogId = code.startsWith(norm(CATALOG_PREFIX)) ? String(rawCode).trim().slice(CATALOG_PREFIX.length) : null;
  const item = jobItems.find((i) =>
    (catalogId && i.catalogId === catalogId)
    || (i.barcode && norm(i.barcode) === code)
    || (i.serialNumber && norm(i.serialNumber).split(/,\s*/).includes(code)));
  if (item) return { kind: 'ITEM', item };

  const catalogItem = catalog.find((c) =>
    (catalogId && c.id === catalogId)
    || (c.barcode && norm(c.barcode) === code)
    || norm(c.id) === code);
  if (catalogItem) return { kind: 'CATALOG', catalogItem };

  return { kind: 'UNKNOWN' };
}

/**
 * Can this unit be scanned onto / off the job in the given phase?
 * Returns null when OK, otherwise a Czech reason.
 */
export function unitScanProblem(unit, item, mode, jobId) {
  if (unit.status === 'RETIRED') return `${unit.code} je vyřazený`;
  if (mode === 'LOADING') {
    if (unit.status === 'IN_SERVICE') return `${unit.code} je v servisu`;
    if (item?.unitIds?.includes(unit.id)) return `${unit.code} už je naložený`;
  }
  if (mode === 'DERIGGING' && item?.packedUnitIds?.includes(unit.id)) return `${unit.code} už je sbalený`;
  if (mode === 'RESTOCK' && item?.returnedUnitIds?.includes(unit.id)) return `${unit.code} už je naskladněný`;
  if ((mode === 'DERIGGING' || mode === 'RESTOCK') && item?.unitIds?.length && !item.unitIds.includes(unit.id) && unit.jobId !== jobId) {
    return `${unit.code} nebyl na této zakázce naložený`;
  }
  return null;
}

/** Labelled units that went out with the job and did not come back. */
export function missingUnitIds(item) {
  const back = new Set(item.returnedUnitIds || []);
  return (item.unitIds || []).filter((id) => !back.has(id));
}
