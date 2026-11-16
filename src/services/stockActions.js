// Warehouse actions: stock levels, units, movements, job issue/restock, stocktakes.
// Every change of a count is an atomic increment (safe with several people and
// offline) and leaves an immutable record in `movements`.
import {
  MOVEMENT_TYPES, trackingOf, issuePlan, restockPlan, buildStocktakeLines, stocktakeResult, levelOf,
} from '../domain/stock.js';
import { enterRestock, applyQuantityDelta, markDone } from '../domain/items.js';
import { nextUnitCodes, resolveCode, unitScanProblem, missingUnitIds, codeKey } from '../domain/labels-qr.js';
import { phaseOf } from '../domain/labels.js';

const BATCH = 400;

export function createStockActions({ repo, getState, getActor }) {
  const now = () => new Date().toISOString();
  const nameOf = (catalogId) => getState().catalog.find((c) => c.id === catalogId)?.name || catalogId;

  const commitAll = (ops) => { for (let i = 0; i < ops.length; i += BATCH) repo.commit(ops.slice(i, i + BATCH)); };

  /** Level change (+ creates the level document if it does not exist yet). */
  const levelOp = (catalogId, deltas) => ({
    type: 'merge', col: 'stockLevels', id: catalogId,
    data: {
      catalogId,
      ...Object.fromEntries(Object.entries(deltas).filter(([, n]) => n).map(([k, n]) => [k, { __inc: n }])),
      updatedAt: now(), updatedBy: getActor(),
    },
  });

  const movementOp = (type, catalogId, qty, extra = {}) => {
    const id = repo.newId('movements');
    return {
      type: 'set', col: 'movements', id,
      data: {
        id, type, label: MOVEMENT_TYPES[type] || type, catalogId, itemName: nameOf(catalogId),
        qty, timestamp: now(), user: getActor(), ...extra,
      },
    };
  };

  const positive = (n) => Math.max(0, Math.floor(Number(n) || 0));

  return {
    /** First set-up: stock in the warehouse = "available count" from the catalog. */
    initStockFromCatalog() {
      const { catalog, stockLevels } = getState();
      const existing = new Set(stockLevels.map((l) => l.id));
      const ops = [];
      for (const c of catalog) {
        if (c.isBundle || existing.has(c.id)) continue;
        const qty = positive(c.availableCount);
        ops.push({ type: 'set', col: 'stockLevels', id: c.id, data: { catalogId: c.id, inStock: qty, onJob: 0, inService: 0, missing: 0, updatedAt: now(), updatedBy: getActor() } });
        ops.push(movementOp('INIT', c.id, qty, { note: 'Výchozí stav podle katalogu' }));
      }
      commitAll(ops);
      return ops.length / 2;
    },

    receive(catalogId, qty, note = '') {
      const n = positive(qty);
      if (!n) return;
      repo.commit([levelOp(catalogId, { inStock: n }), movementOp('RECEIPT', catalogId, n, { note })]);
    },

    retire(catalogId, qty, note = '') {
      const n = positive(qty);
      if (!n) return;
      repo.commit([levelOp(catalogId, { inStock: -n }), movementOp('RETIRE', catalogId, n, { note })]);
    },

    toService(catalogId, qty, note = '') {
      const n = positive(qty);
      if (!n) return;
      repo.commit([levelOp(catalogId, { inStock: -n, inService: n }), movementOp('TO_SERVICE', catalogId, n, { note })]);
    },

    fromService(catalogId, qty, note = '') {
      const n = positive(qty);
      if (!n) return;
      repo.commit([levelOp(catalogId, { inStock: n, inService: -n }), movementOp('FROM_SERVICE', catalogId, n, { note })]);
    },

    setTracking(catalogId, trackingType) {
      repo.commit([{ type: 'update', col: 'catalog', id: catalogId, data: { trackingType, updatedAt: now(), updatedBy: getActor() } }]);
    },

    /** New labelled unit (light / ballast) received into the warehouse. Returns error text or null. */
    addUnit(catalogId, code, serialNumber = '') {
      const clean = String(code || '').trim();
      if (!clean) return 'Zadejte kód kusu.';
      if (getState().stockUnits.some((u) => codeKey(u.code) === codeKey(clean))) return `Kód ${clean} už má jiný kus.`;
      const id = repo.newId('stockUnits');
      repo.commit([
        { type: 'set', col: 'stockUnits', id, data: { id, catalogId, code: clean, serialNumber: serialNumber || clean, status: 'IN_STOCK', createdAt: now(), updatedAt: now(), updatedBy: getActor() } },
        levelOp(catalogId, { inStock: 1 }),
        movementOp('RECEIPT', catalogId, 1, { unitId: id, unitCode: clean }),
      ]);
      return null;
    },

    /**
     * Labels for pieces that are already in the warehouse (no change of counts).
     * At most as many as there are unlabelled pieces in stock. Returns the new codes.
     */
    labelExistingUnits(catalogId, count) {
      const { catalog, stockUnits, stockLevels } = getState();
      const item = catalog.find((c) => c.id === catalogId);
      if (!item) return [];
      const labelledInStock = stockUnits.filter((u) => u.catalogId === catalogId && u.status === 'IN_STOCK').length;
      const free = Math.max(0, levelOf(stockLevels, catalogId).inStock - labelledInStock);
      const n = Math.min(positive(count), free);
      if (!n) return [];
      const codes = nextUnitCodes(item.serialPrefix || item.name.slice(0, 3), stockUnits.map((u) => u.code), n);
      const ops = codes.map((code) => {
        const id = repo.newId('stockUnits');
        return { type: 'set', col: 'stockUnits', id, data: { id, catalogId, code, serialNumber: code, status: 'IN_STOCK', createdAt: now(), updatedAt: now(), updatedBy: getActor() } };
      });
      ops.push(movementOp('LABEL', catalogId, n, { note: `Štítky ${codes[0]} – ${codes[codes.length - 1]}` }));
      commitAll(ops);
      return codes;
    },

    /**
     * A code scanned on a job — behaves according to the job phase:
     *   Rigging    +1 loaded (labelled unit is recorded on the job, never twice)
     *   Derigging  packed (labelled units count one by one)
     *   Restock    +1 back in the warehouse (labelled unit leaves the job)
     * Returns { ok, message, needsAdd?: catalogItem, warning? } for the UI.
     */
    scanOnJob(jobId, code) {
      const { jobs, jobItems, catalog, stockUnits } = getState();
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return { ok: false, message: 'Není vybraná zakázka.' };
      if (job.status === 'ARCHIVED') return { ok: false, message: 'Zakázka je v archivu.' };
      const mode = job.mode || 'LOADING';
      const items = jobItems.filter((i) => i.jobId === jobId);
      const r = resolveCode(code, { jobItems: items, catalog, units: stockUnits });
      const audit = (item, detail) => {
        const id = repo.newId('auditLogs');
        return { type: 'set', col: 'auditLogs', id, data: { id, timestamp: now(), user: getActor(), jobId, action: `Sken – ${phaseOf(mode).name}`, detail: `${item.name}: ${detail}`, type: 'loaded' } };
      };
      const itemUpdate = (item, data) => ({ type: 'update', col: 'jobItems', id: item.id, data: { ...data, updatedAt: now(), updatedBy: getActor() } });

      if (r.kind === 'UNKNOWN') return { ok: false, message: `Neznámý kód ${code}` };
      if (r.kind === 'CATALOG') return { ok: false, needsAdd: r.catalogItem, message: `${r.catalogItem.name} není na zakázce` };
      if (r.kind === 'UNIT' && !r.item) {
        const catalogItem = catalog.find((c) => c.id === r.unit.catalogId);
        return { ok: false, needsAdd: catalogItem, message: `${catalogItem?.name || r.unit.code} není na zakázce` };
      }

      const item = r.item;
      if (r.kind === 'UNIT') {
        const unit = r.unit;
        const problem = unitScanProblem(unit, item, mode, jobId);
        if (problem) return { ok: false, message: problem };
        const otherJob = unit.jobId && unit.jobId !== jobId ? jobs.find((j) => j.id === unit.jobId && j.status === 'ACTIVE') : null;
        const warning = otherJob ? `Pozor: ${unit.code} byl veden na zakázce ${otherJob.name}` : null;

        if (mode === 'LOADING') {
          const patch = applyQuantityDelta(item, 1, mode);
          repo.commit([
            itemUpdate(item, { ...patch, unitIds: { __union: [unit.id] } }),
            { type: 'update', col: 'stockUnits', id: unit.id, data: { jobId, jobName: job.name, updatedAt: now(), updatedBy: getActor() } },
            audit(item, `naložen kus ${unit.code} (${patch.quantityLoaded}/${patch.quantityRequested})`),
          ]);
          return { ok: true, warning, message: `${item.name} · ${unit.code} · ${patch.quantityLoaded}/${patch.quantityRequested}` };
        }
        if (mode === 'DERIGGING') {
          const packed = (item.packedUnitIds?.length || 0) + 1;
          const done = packed >= (item.quantityRequested || 0);
          repo.commit([
            itemUpdate(item, { packedUnitIds: { __union: [unit.id] }, ...(done ? markDone(item, mode) : {}) }),
            audit(item, `sbalen kus ${unit.code} (${packed}/${item.quantityRequested})`),
          ]);
          return { ok: true, warning, message: `${item.name} · ${unit.code} · sbaleno ${packed}/${item.quantityRequested}` };
        }
        // RESTOCK
        const patch = applyQuantityDelta(item, 1, mode);
        repo.commit([
          itemUpdate(item, { ...patch, returnedUnitIds: { __union: [unit.id] } }),
          { type: 'update', col: 'stockUnits', id: unit.id, data: { jobId: null, jobName: null, ...(unit.status === 'MISSING' ? { status: 'IN_STOCK' } : {}), updatedAt: now(), updatedBy: getActor() } },
          audit(item, `naskladněn kus ${unit.code} (${patch.quantityLoaded}/${patch.quantityRequested})`),
        ]);
        return { ok: true, warning, message: `${item.name} · ${unit.code} · zpět ${patch.quantityLoaded}/${patch.quantityRequested}` };
      }

      // Job line identified by a catalog label / barcode / serial number
      if (mode === 'DERIGGING') {
        repo.commit([itemUpdate(item, markDone(item, mode)), audit(item, 'sbaleno (sken)')]);
        return { ok: true, message: `${item.name} · sbaleno` };
      }
      const patch = applyQuantityDelta(item, 1, mode);
      repo.commit([itemUpdate(item, patch), audit(item, `+1 (${patch.quantityLoaded}/${patch.quantityRequested})`)]);
      return { ok: true, message: `${item.name} · ${patch.quantityLoaded}/${patch.quantityRequested}` };
    },

    /** Unit to service / back / retired — keeps the counts in step. */
    setUnitStatus(unitId, status, note = '') {
      const unit = getState().stockUnits.find((u) => u.id === unitId);
      if (!unit || unit.status === status) return;
      const field = { IN_STOCK: 'inStock', IN_SERVICE: 'inService', MISSING: 'missing', RETIRED: null };
      const deltas = {};
      if (field[unit.status]) deltas[field[unit.status]] = -1;
      if (field[status]) deltas[field[status]] = (deltas[field[status]] || 0) + 1;
      const type = status === 'IN_SERVICE' ? 'TO_SERVICE'
        : status === 'RETIRED' ? 'RETIRE'
          : status === 'MISSING' ? 'MISSING'
            : unit.status === 'MISSING' ? 'FOUND' : 'FROM_SERVICE';
      repo.commit([
        { type: 'update', col: 'stockUnits', id: unitId, data: { status, ...(status === 'IN_STOCK' ? { jobId: null, jobName: null } : {}), updatedAt: now(), updatedBy: getActor() } },
        levelOp(unit.catalogId, deltas),
        movementOp(type, unit.catalogId, 1, { unitId, unitCode: unit.code, note }),
      ]);
    },

    // ── Jobs ─────────────────────────────────────────────────
    /** Loaded equipment leaves the warehouse (once per job). Returns the plan. */
    issueJob(jobId) {
      const { jobs, jobItems } = getState();
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.issued) return null;
      const plan = issuePlan(jobItems.filter((i) => i.jobId === jobId));
      const ops = [{ type: 'update', col: 'jobs', id: jobId, data: { issued: plan, issuedAt: now(), updatedAt: now(), updatedBy: getActor() } }];
      for (const [catalogId, qty] of Object.entries(plan)) {
        ops.push(levelOp(catalogId, { inStock: -qty, onJob: qty }));
        ops.push(movementOp('ISSUE', catalogId, qty, { jobId, jobName: job.name }));
      }
      commitAll(ops);
      return plan;
    },

    /** Job goes back to rigging: the issue is cancelled (pieces back in stock). */
    unissueJob(jobId) {
      const { jobs, jobItems } = getState();
      const job = jobs.find((j) => j.id === jobId);
      if (!job?.issued) return null;
      const ops = [{ type: 'update', col: 'jobs', id: jobId, data: { issued: null, issuedAt: null, updatedAt: now(), updatedBy: getActor() } }];
      // Packing started in derigging is forgotten when going back to rigging.
      jobItems.filter((i) => i.jobId === jobId && i.packedUnitIds?.length)
        .forEach((i) => ops.push({ type: 'update', col: 'jobItems', id: i.id, data: { packedUnitIds: [] } }));
      for (const [catalogId, qty] of Object.entries(job.issued)) {
        ops.push(levelOp(catalogId, { inStock: qty, onJob: -qty }));
        ops.push(movementOp('RETURN', catalogId, qty, { jobId, jobName: job.name, note: 'Zrušení výdeje (zpět na rigging)' }));
      }
      commitAll(ops);
      return job.issued;
    },

    /** Start counting the equipment back into the warehouse. */
    startRestock(jobId) {
      const { jobs, jobItems } = getState();
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      const ops = [{ type: 'update', col: 'jobs', id: jobId, data: { mode: 'RESTOCK', updatedAt: now(), updatedBy: getActor() } }];
      for (const item of jobItems.filter((i) => i.jobId === jobId)) {
        const patch = { ...enterRestock(item), ...(item.unitIds?.length ? { returnedUnitIds: [] } : {}) };
        if (Object.keys(patch).length) ops.push({ type: 'update', col: 'jobItems', id: item.id, data: { ...patch, updatedAt: now(), updatedBy: getActor() } });
      }
      commitAll(ops);
    },

    /**
     * Finish restock: returned pieces back to the warehouse, damaged to service,
     * the rest recorded as missing; the job is archived. Returns the plan.
     * Jobs started before stock tracking (no `issued`) never left the stock, so
     * only damaged pieces are moved to service.
     */
    finishRestock(jobId) {
      const { jobs, jobItems } = getState();
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return null;
      const tracked = !!job.issued;
      const plan = restockPlan(jobItems.filter((i) => i.jobId === jobId), job.issued || {});
      const ops = [{ type: 'update', col: 'jobs', id: jobId, data: { status: 'ARCHIVED', restockedAt: now(), restockPlan: plan, updatedAt: now(), updatedBy: getActor() } }];
      for (const [catalogId, r] of Object.entries(plan)) {
        const extra = { jobId, jobName: job.name };
        if (tracked) {
          ops.push(levelOp(catalogId, { onJob: -r.issued, inStock: r.returned, inService: r.toService, missing: r.missing }));
          if (r.returned) ops.push(movementOp('RETURN', catalogId, r.returned, extra));
        } else if (r.toService) {
          ops.push(levelOp(catalogId, { inStock: -r.toService, inService: r.toService }));
        }
        if (r.toService) ops.push(movementOp('TO_SERVICE', catalogId, r.toService, { ...extra, note: 'Závada ze zakázky' }));
        if (tracked && r.missing) ops.push(movementOp('MISSING', catalogId, r.missing, extra));
      }
      // Labelled units scanned onto the job that did not come back are missing by name.
      const { stockUnits } = getState();
      const missingUnits = [];
      for (const item of jobItems.filter((i) => i.jobId === jobId)) {
        for (const unitId of missingUnitIds(item)) {
          const unit = stockUnits.find((u) => u.id === unitId);
          if (!unit) continue;
          missingUnits.push(unit.code);
          ops.push({ type: 'update', col: 'stockUnits', id: unitId, data: { status: item.status === 'DAMAGED' ? 'IN_SERVICE' : 'MISSING', updatedAt: now(), updatedBy: getActor() } });
        }
      }
      if (missingUnits.length) ops[0].data.missingUnits = missingUnits;
      commitAll(ops);
      return { ...plan, ...(missingUnits.length ? { __missingUnits: missingUnits } : {}) };
    },

    // ── Stocktake ────────────────────────────────────────────
    startStocktake({ category = 'ALL', note = '' } = {}) {
      const { catalog, stockLevels, stockUnits, stocktakes } = getState();
      if (stocktakes.some((s) => s.status === 'OPEN')) return null;
      const id = repo.newId('stocktakes');
      const lines = buildStocktakeLines(catalog, stockLevels, stockUnits, { category });
      const ops = [{
        type: 'set', col: 'stocktakes', id,
        data: { id, status: 'OPEN', category, note, lineCount: lines.length, startedAt: now(), startedBy: getActor() },
      }];
      for (const line of lines) {
        const lineId = `${id}_${line.catalogId}`;
        ops.push({ type: 'set', col: 'stocktakeLines', id: lineId, data: { ...line, id: lineId, stocktakeId: id, open: true, scannedUnitIds: [], extraCount: 0 } });
      }
      commitAll(ops);
      return id;
    },

    countLine(lineId, counted) {
      repo.update('stocktakeLines', lineId, { counted: positive(counted), countedBy: getActor(), countedAt: now() });
    },

    setLineExtra(lineId, extraCount) {
      repo.update('stocktakeLines', lineId, { extraCount: positive(extraCount), touched: true, countedBy: getActor(), countedAt: now() });
    },

    /** Scanned code → finds the unit and marks it in its line. Returns a short result for the UI. */
    scanUnitCode(stocktakeId, code) {
      const clean = codeKey(code);
      const { stockUnits, stocktakeLines } = getState();
      const unit = stockUnits.find((u) => codeKey(u.code) === clean || (u.serialNumber && codeKey(u.serialNumber) === clean));
      if (!unit) return { ok: false, message: `Neznámý kód ${code}` };
      const line = stocktakeLines.find((l) => l.stocktakeId === stocktakeId && l.catalogId === unit.catalogId);
      if (!line) return { ok: false, message: `${nameOf(unit.catalogId)} není v této inventuře` };
      if (line.scannedUnitIds?.includes(unit.id)) return { ok: true, duplicate: true, message: `${unit.code} už je započítán`, unit, line };
      repo.update('stocktakeLines', line.id, { scannedUnitIds: { __union: [unit.id] }, touched: true, countedBy: getActor(), countedAt: now() });
      return { ok: true, message: `${nameOf(unit.catalogId)} · ${unit.code}`, unit, line };
    },

    toggleUnitInLine(lineId, unitId, found) {
      repo.update('stocktakeLines', lineId, {
        scannedUnitIds: found ? { __union: [unitId] } : { __remove: [unitId] },
        touched: true, countedBy: getActor(), countedAt: now(),
      });
    },

    /** Applies the differences to the stock (relative to the snapshot taken at start). */
    approveStocktake(stocktakeId) {
      const { stocktakeLines } = getState();
      const lines = stocktakeLines.filter((l) => l.stocktakeId === stocktakeId);
      const result = stocktakeResult(lines);
      const ops = [{
        type: 'update', col: 'stocktakes', id: stocktakeId,
        data: {
          status: 'APPROVED', approvedAt: now(), approvedBy: getActor(),
          summary: { differences: result.differences.length, matching: result.matching, notCounted: result.notCounted.length },
          differences: result.differences.map((d) => ({ catalogId: d.catalogId, name: d.name, expected: d.expected, counted: d.counted, diff: d.diff })),
        },
      }];
      for (const d of result.differences) {
        // Extra pieces first settle pieces recorded as missing after a job.
        const found = d.diff > 0 ? Math.min(d.diff, levelOf(getState().stockLevels, d.catalogId).missing || 0) : 0;
        ops.push(levelOp(d.catalogId, { inStock: d.diff, missing: -found }));
        ops.push(movementOp('STOCKTAKE', d.catalogId, d.diff, {
          stocktakeId,
          note: `Očekáváno ${d.expected}, napočítáno ${d.counted}${found ? ` (nalezeno ${found} ks vedených jako chybějící)` : ''}`,
        }));
      }
      for (const l of lines) ops.push({ type: 'update', col: 'stocktakeLines', id: l.id, data: { open: false } });
      // Labelled units found in the warehouse are in stock again (e.g. missing after a job).
      const { stockUnits } = getState();
      const found = new Set(lines.flatMap((l) => l.scannedUnitIds || []));
      for (const u of stockUnits) {
        if (found.has(u.id) && (u.status === 'MISSING' || u.jobId)) {
          ops.push({ type: 'update', col: 'stockUnits', id: u.id, data: { status: 'IN_STOCK', jobId: null, jobName: null, updatedAt: now(), updatedBy: getActor() } });
        }
      }
      commitAll(ops);
      return result;
    },

    cancelStocktake(stocktakeId) {
      const lines = getState().stocktakeLines.filter((l) => l.stocktakeId === stocktakeId);
      commitAll([
        { type: 'update', col: 'stocktakes', id: stocktakeId, data: { status: 'CANCELLED', cancelledAt: now(), cancelledBy: getActor() } },
        ...lines.map((l) => ({ type: 'update', col: 'stocktakeLines', id: l.id, data: { open: false } })),
      ]);
    },

    // Helpers for the UI
    levelOf: (catalogId) => levelOf(getState().stockLevels, catalogId),
    trackingOf,
  };
}
