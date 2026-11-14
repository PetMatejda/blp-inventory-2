// Warehouse rules (ANALYZA_A_NAVRH.md, chapter 4) — pure functions, no storage.
//
// Locations: warehouse (inStock), on a job (onJob), service (inService).
// Lights and ballasts are tracked per unit (own code / SN, stockUnits); everything
// else only by count. Counts for all items live in stockLevels/{catalogId}.

import { getCategoryMeta } from '../utils/categoryIcons.jsx';

export const SERIAL_CATEGORIES = ['Lights', 'Ballasts'];

export const MOVEMENT_TYPES = {
  INIT: 'Založení stavu',
  RECEIPT: 'Příjem na sklad',
  ISSUE: 'Výdej na zakázku',
  RETURN: 'Vráceno ze zakázky',
  MISSING: 'Chybí po zakázce',
  TO_SERVICE: 'Do servisu',
  FROM_SERVICE: 'Ze servisu',
  RETIRE: 'Vyřazení',
  STOCKTAKE: 'Inventurní rozdíl',
};

export const trackingOf = (catalogItem) =>
  catalogItem?.trackingType
  || (SERIAL_CATEGORIES.includes(getCategoryMeta(catalogItem?.category).id) ? 'SERIAL' : 'QUANTITY');

export const emptyLevel = { inStock: 0, onJob: 0, inService: 0, missing: 0 };
export const levelOf = (levels, catalogId) => ({ ...emptyLevel, ...(levels?.find?.((l) => l.id === catalogId) || {}) });

/** Pieces the company has and knows where they are (missing pieces excluded). */
export const ownedCount = (level) => (level.inStock || 0) + (level.onJob || 0) + (level.inService || 0);

const day = (iso) => String(iso || '').slice(0, 10);
const jobStart = (job) => day(job.riggingDate || job.date);
const jobEnd = (job) => day(job.deriggingDate || job.riggingDate || job.date);

/** Do two jobs overlap in time (dates inclusive)? Jobs without dates overlap everything. */
export function jobsOverlap(a, b) {
  const [as, ae, bs, be] = [jobStart(a), jobEnd(a), jobStart(b), jobEnd(b)];
  if (!as || !bs) return true;
  return as <= (be || bs) && bs <= (ae || as);
}

/**
 * How many pieces of a catalog item are free for a job in its date range.
 * Returns null while the warehouse stock has not been set up for the item.
 */
export function availability(catalogId, job, { jobs = [], jobItems = [], levels = [] }) {
  const levelDoc = levels.find((l) => l.id === catalogId);
  if (!levelDoc) return null;
  const owned = ownedCount(levelOf(levels, catalogId));
  const otherJobs = new Set(jobs
    .filter((j) => j.id !== job?.id && j.status === 'ACTIVE' && j.mode !== 'RESTOCK' && (!job || jobsOverlap(j, job)))
    .map((j) => j.id));
  const sum = (pred) => jobItems.filter((i) => i.catalogId === catalogId && pred(i)).reduce((s, i) => s + (i.quantityRequested || 0), 0);
  const reservedElsewhere = sum((i) => otherJobs.has(i.jobId));
  const requestedHere = job ? sum((i) => i.jobId === job.id) : 0;
  const free = owned - reservedElsewhere - requestedHere;
  return { owned, reservedElsewhere, requestedHere, free, short: Math.max(0, -free) };
}

/** Pieces per catalog item that physically left the warehouse with the job. */
export function issuePlan(items) {
  const plan = {};
  for (const i of items) {
    if (!i.catalogId || !(i.quantityLoaded > 0)) continue;
    plan[i.catalogId] = (plan[i.catalogId] || 0) + i.quantityLoaded;
  }
  return plan;
}

/**
 * What happens to stock when a job's restock (naskladnění) is finished.
 * In the restock phase quantityLoaded = pieces counted back in the warehouse;
 * DAMAGED items go to service. Whatever was issued and did not come back is missing.
 * Returns per catalogId { issued, returned, toService, missing }.
 */
export function restockPlan(items, issued = {}) {
  const plan = {};
  const row = (id) => (plan[id] ||= { issued: issued[id] || 0, returned: 0, toService: 0, missing: 0 });
  for (const i of items) {
    if (!i.catalogId) continue;
    const r = row(i.catalogId);
    if (i.status === 'DAMAGED') r.toService += i.quantityLoaded || 0;
    else r.returned += i.quantityLoaded || 0;
  }
  Object.keys(issued).forEach(row);
  for (const r of Object.values(plan)) {
    r.missing = Math.max(0, r.issued - r.returned - r.toService);
  }
  return plan;
}

/** Lines of a stocktake: what the system expects in the warehouse right now. */
export function buildStocktakeLines(catalog, levels, units, { category = 'ALL' } = {}) {
  return catalog
    .filter((c) => !c.isBundle)
    .filter((c) => category === 'ALL' || getCategoryMeta(c.category).id === category)
    .map((c) => {
      const tracking = trackingOf(c);
      return {
        catalogId: c.id,
        name: c.name,
        category: c.category,
        tracking,
        expected: levelOf(levels, c.id).inStock,
        expectedUnitIds: tracking === 'SERIAL'
          ? units.filter((u) => u.catalogId === c.id && u.status === 'IN_STOCK').map((u) => u.id)
          : [],
      };
    });
}

/** Counted pieces of a stocktake line (scanned units + manually counted pieces). */
export const countedOf = (line) =>
  line.tracking === 'SERIAL'
    ? (line.scannedUnitIds?.length || 0) + (line.extraCount || 0)
    : (line.counted ?? null);

/** Differences found by a stocktake. Lines not counted at all are reported separately. */
export function stocktakeResult(lines) {
  const differences = [];
  const notCounted = [];
  let matching = 0;
  for (const line of lines) {
    const counted = countedOf(line);
    const touched = line.tracking === 'SERIAL' ? line.touched || counted > 0 : counted !== null;
    if (!touched) { notCounted.push(line); continue; }
    const diff = counted - (line.expected || 0);
    if (diff === 0) matching++;
    else differences.push({ ...line, counted, diff });
  }
  return { differences, notCounted, matching };
}

/** CSV for Excel (Czech locale: semicolon separator, BOM for diacritics). */
export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(';'));
  return '﻿' + [head, ...body].join('\r\n');
}
