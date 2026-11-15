// Planning a job's equipment in bulk (MCP tool plan_job_items, later the voice sheet).
// Pure: takes the job, its items and the catalog, returns what would change.
//
// Line: { catalogId?, jobItemId?, quantity, op: 'ADD' | 'SET' | 'REMOVE' }
//   ADD     plan + quantity (new item from the catalog when the job has none; a set
//           (bundle) adds its parts × quantity)
//   SET     plan = quantity (0 = remove)
//   REMOVE  delete the item — only while nothing of it is loaded
import { applyRequestedQuantity, newItemFromCatalog } from './items.js';

const norm = (s) => String(s || '').toLowerCase().trim();
export const PLAN_OPS = ['ADD', 'SET', 'REMOVE'];

/**
 * @returns {{
 *   errors: string[],                     // whole plan refused (job state)
 *   warnings: string[],                   // single lines skipped
 *   changes: { type: 'create'|'update'|'delete', name, catalogId, itemId?, before?, after? }[],
 *   creates: object[], updates: { item, patch }[], deletes: object[],
 * }}
 */
export function planJobItems({ job, jobItems = [], catalog = [], lines = [] }) {
  const result = { errors: [], warnings: [], changes: [], creates: [], updates: [], deletes: [] };
  if (!job) { result.errors.push('Zakázka neexistuje.'); return result; }
  if (job.status === 'ARCHIVED') result.errors.push(`Zakázka ${job.name} je v archivu.`);
  if ((job.mode || 'LOADING') !== 'LOADING') result.errors.push(`Zakázka ${job.name} není ve fázi přípravy/nakládky (${job.mode}) – plán položek už nejde měnit.`);
  if (result.errors.length) return result;

  const byId = new Map(catalog.map((c) => [c.id, c]));
  // Working copy: existing items with their (possibly changed) plan + new items.
  const work = jobItems.filter((i) => i.jobId === job.id).map((item) => ({ item, requested: item.quantityRequested || 0, removed: false, isNew: false }));
  const findWork = ({ catalogId, name, jobItemId }) => work.find((w) => !w.removed && (
    (jobItemId && w.item.id === jobItemId)
    || (catalogId && w.item.catalogId === catalogId)
    || (!jobItemId && name && norm(w.item.name) === norm(name))
  ));

  const addPiece = (catalogItem, qty, fallbackName, category) => {
    const existing = findWork({ catalogId: catalogItem?.id, name: catalogItem?.name || fallbackName });
    if (existing) { existing.requested += qty; return; }
    const base = catalogItem
      ? newItemFromCatalog(job.id, catalogItem)
      : { ...newItemFromCatalog(job.id, { id: null, name: fallbackName, category }), catalogId: null };
    work.push({ item: { ...base, quantityRequested: qty }, requested: qty, removed: false, isNew: true });
  };

  lines.forEach((line, index) => {
    const label = `Řádek ${index + 1}`;
    const op = String(line.op || 'ADD').toUpperCase();
    const qty = Math.floor(Number(line.quantity ?? (op === 'REMOVE' ? 0 : 1)));
    if (!PLAN_OPS.includes(op)) { result.warnings.push(`${label}: neznámá operace ${line.op}.`); return; }
    if (op !== 'REMOVE' && (!Number.isFinite(qty) || qty < 0 || (op === 'ADD' && qty < 1))) {
      result.warnings.push(`${label}: neplatný počet ${line.quantity}.`); return;
    }
    const catalogItem = line.catalogId ? byId.get(line.catalogId) : null;
    if (line.catalogId && !catalogItem) { result.warnings.push(`${label}: položka katalogu ${line.catalogId} neexistuje.`); return; }
    if (!catalogItem && !line.jobItemId) { result.warnings.push(`${label}: chybí catalogId nebo jobItemId.`); return; }

    if (catalogItem?.isBundle && catalogItem.bundleItems?.length) {
      if (op !== 'ADD') { result.warnings.push(`${label}: set ${catalogItem.name} lze jen přidat (ADD) – jednotlivé díly upravte samostatně.`); return; }
      for (const sub of catalogItem.bundleItems) {
        const subCatalog = catalog.find((c) => norm(c.name) === norm(sub.name));
        addPiece(subCatalog, (sub.qty || 1) * qty, sub.name, catalogItem.category);
      }
      return;
    }

    const target = findWork({ catalogId: catalogItem?.id, jobItemId: line.jobItemId });
    if (op === 'ADD') {
      if (target) target.requested += qty;
      else addPiece(catalogItem, qty);
      return;
    }
    if (op === 'SET' && qty > 0) {
      if (target) target.requested = qty;
      else if (catalogItem) addPiece(catalogItem, qty);
      else result.warnings.push(`${label}: položka ${line.jobItemId} na zakázce není.`);
      return;
    }
    // REMOVE (or SET 0)
    if (!target) { result.warnings.push(`${label}: ${catalogItem?.name || line.jobItemId} na zakázce není, není co odebrat.`); return; }
    if ((target.item.quantityLoaded || 0) > 0) {
      result.warnings.push(`${label}: ${target.item.name} už má naloženo ${target.item.quantityLoaded} ks – odebrat nelze, jen snížit plán (SET).`);
      return;
    }
    target.removed = true;
  });

  for (const w of work) {
    const { item } = w;
    const name = item.name;
    if (w.isNew) {
      if (w.removed || w.requested < 1) continue;
      const created = { ...item, quantityRequested: w.requested };
      result.creates.push(created);
      result.changes.push({ type: 'create', name, catalogId: item.catalogId, after: { planned: w.requested } });
    } else if (w.removed) {
      result.deletes.push(item);
      result.changes.push({ type: 'delete', name, catalogId: item.catalogId, itemId: item.id, before: { planned: item.quantityRequested || 0, loaded: item.quantityLoaded || 0 } });
    } else if (w.requested !== (item.quantityRequested || 0)) {
      const patch = applyRequestedQuantity(item, w.requested, 'LOADING');
      result.updates.push({ item, patch });
      result.changes.push({
        type: 'update', name, catalogId: item.catalogId, itemId: item.id,
        before: { planned: item.quantityRequested || 0, loaded: item.quantityLoaded || 0 },
        after: { planned: patch.quantityRequested, loaded: patch.quantityLoaded },
      });
    }
  }
  return result;
}

/** One-line human summary of the changes (audit, previews). */
export function describePlan(changes) {
  return changes.map((c) => {
    if (c.type === 'create') return `+ ${c.name} (${c.after.planned} ks)`;
    if (c.type === 'delete') return `− ${c.name}`;
    return `${c.name}: ${c.before.planned} → ${c.after.planned} ks`;
  }).join(', ');
}
