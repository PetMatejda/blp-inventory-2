// Labels and scanned codes (phase 4b) — pure functions.
//
// Label payloads:
//   labelled unit (light, ballast) → its own code, e.g. "FL-001"
//   item tracked by count          → "BLP:<catalogId>" (for boxes / shelves)
// Existing EAN barcodes and serial numbers keep working when scanned.

export const CATALOG_PREFIX = 'BLP:';

export const catalogLabelPayload = (catalogItem) => `${CATALOG_PREFIX}${catalogItem.id}`;

/**
 * Form in which two codes are compared: trimmed, lower case and — for codes made
 * of digits only — without leading zeros. The old Comsys labels carry the
 * evidence number padded to six digits ("000241"), the unit is stored as "241".
 */
export const codeKey = (s) => {
  const key = String(s ?? '').trim().toLowerCase();
  return /^\d+$/.test(key) ? key.replace(/^0+(?=\d)/, '') : key;
};
const norm = codeKey;

/**
 * Catalog ids a typed text points to as a code: a labelled unit (code or serial
 * number) or the item's own barcode. Used by the search fields, where people
 * type the number from the label instead of scanning it.
 */
export function catalogIdsByCode(text, { catalog = [], units = [] }) {
  const code = codeKey(text);
  const ids = new Set();
  if (!code) return ids;
  for (const u of units) {
    if (u.status !== 'RETIRED' && (codeKey(u.code) === code || (u.serialNumber && codeKey(u.serialNumber) === code))) ids.add(u.catalogId);
  }
  for (const c of catalog) if (c.barcode && codeKey(c.barcode) === code) ids.add(c.id);
  return ids;
}

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
    || (i.serialNumber && String(i.serialNumber).split(',').map(norm).includes(code)));
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
