// In-memory stand-in for the Firestore repo (same interface as inventoryRepo.js).
export function createMemoryRepo(seed = {}) {
  const cols = {};
  const ensure = (col) => (cols[col] ||= new Map());
  Object.entries(seed).forEach(([col, records]) => records.forEach((r) => ensure(col).set(r.id, { ...r })));
  let seq = 0;
  const log = [];

  const apply = (op) => {
    const store = ensure(op.col);
    if (op.type === 'set') store.set(op.id, { ...op.data, id: op.id });
    else if (op.type === 'update') {
      if (!store.has(op.id)) throw new Error(`update of missing ${op.col}/${op.id}`);
      store.set(op.id, { ...store.get(op.id), ...op.data });
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
  });

  return { repo, state, all, log };
}
