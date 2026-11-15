// In-memory stand-in for the Firestore repo (same interface as inventoryRepo.js),
// including the { __inc }, { __union }, { __remove } field markers.
export function createMemoryRepo(seed = {}) {
  const cols = {};
  const ensure = (col) => (cols[col] ||= new Map());
  Object.entries(seed).forEach(([col, records]) => records.forEach((r) => ensure(col).set(r.id, { ...r })));
  let seq = 0;
  const log = [];

  const resolve = (current = {}, data) => {
    const out = { ...current };
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (v && typeof v === 'object' && !Array.isArray(v) && '__inc' in v) out[k] = (current[k] || 0) + v.__inc;
      else if (v && typeof v === 'object' && !Array.isArray(v) && '__union' in v) out[k] = [...new Set([...(current[k] || []), ...v.__union])];
      else if (v && typeof v === 'object' && !Array.isArray(v) && '__remove' in v) out[k] = (current[k] || []).filter((x) => !v.__remove.includes(x));
      else out[k] = v;
    }
    return out;
  };

  const apply = (op) => {
    const store = ensure(op.col);
    if (op.type === 'set') store.set(op.id, { ...resolve({}, op.data), id: op.id });
    else if (op.type === 'merge') store.set(op.id, { ...resolve(store.get(op.id) || {}, op.data), id: op.id });
    else if (op.type === 'update') {
      if (!store.has(op.id)) throw new Error(`update of missing ${op.col}/${op.id}`);
      store.set(op.id, resolve(store.get(op.id), op.data));
    } else if (op.type === 'delete') store.delete(op.id);
  };

  const repo = {
    newId: (col) => `${col}-${++seq}`,
    set: (col, id, data) => { log.push({ type: 'set', col, id }); apply({ type: 'set', col, id, data }); return Promise.resolve(); },
    update: (col, id, data) => { log.push({ type: 'update', col, id }); apply({ type: 'update', col, id, data }); return Promise.resolve(); },
    remove: (col, id) => { log.push({ type: 'delete', col, id }); apply({ type: 'delete', col, id }); return Promise.resolve(); },
    commit: (ops) => {
      if (ops.length > 500) throw new Error(`batch too large: ${ops.length}`);
      log.push({ type: 'batch', size: ops.length });
      ops.forEach(apply);
      return Promise.resolve();
    },
  };

  const all = (col) => [...ensure(col).values()];
  const state = () => ({
    jobs: all('jobs'), jobItems: all('jobItems'), catalog: all('catalog'),
    consumables: all('consumables'), auditLogs: all('auditLogs'),
    stockLevels: all('stockLevels'), stockUnits: all('stockUnits'), movements: all('movements'),
    stocktakes: all('stocktakes'), stocktakeLines: all('stocktakeLines').filter((l) => l.open),
    vehicles: all('vehicles'),
  });

  return { repo, state, all, log };
}
