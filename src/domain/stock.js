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
  LABEL: 'Označení štítky',
  FOUND: 'Nalezeno',
};

export const trackingOf = (catalogItem) =>
  catalogItem?.trackingType
  || (SERIAL_CATEGORIES.includes(getCategoryMeta(catalogItem?.category).id) ? 'SERIAL' : 'QUANTITY');

// Availability rules live in availability.js (no UI imports, also used on the server).
import { levelOf } from './availability.js';
export { emptyLevel, levelOf, ownedCount, jobsOverlap, availability } from './availability.js';

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
