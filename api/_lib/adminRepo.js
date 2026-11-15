// Server twin of src/services/inventoryRepo.js: the same repo interface
// ({ newId, set, update, remove, commit }) on top of firebase-admin, so the shared
// actions (src/services/inventoryActions.js) run unchanged on the server.
// Writes are collected; `flush()` waits for them before the function responds.
import { FieldValue } from './firestoreAdmin.js';

/** Field markers → FieldValues; `undefined` dropped (Firestore rejects it). */
export function toAdminData(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('__inc' in v) { out[k] = FieldValue.increment(v.__inc); continue; }
      if ('__union' in v) { out[k] = FieldValue.arrayUnion(...v.__union); continue; }
      if ('__remove' in v) { out[k] = FieldValue.arrayRemove(...v.__remove); continue; }
    }
    out[k] = v;
  }
  return out;
}

export function createAdminRepo(db) {
  const pending = [];
  const track = (p) => { pending.push(p); return p; };
  const ref = (col, id) => db.collection(col).doc(id);

  return {
    newId: (col) => db.collection(col).doc().id,
    set: (col, id, data) => track(ref(col, id).set(toAdminData(data))),
    update: (col, id, data) => track(ref(col, id).update(toAdminData(data))),
    remove: (col, id) => track(ref(col, id).delete()),
    commit(ops) {
      const batch = db.batch();
      for (const op of ops) {
        const r = ref(op.col, op.id);
        if (op.type === 'set') batch.set(r, toAdminData(op.data));
        else if (op.type === 'merge') batch.set(r, toAdminData(op.data), { merge: true });
        else if (op.type === 'update') batch.update(r, toAdminData(op.data));
        else if (op.type === 'delete') batch.delete(r);
      }
      return track(batch.commit());
    },
    /** Wait for every write started through this repo; throws the first error. */
    async flush() {
      const all = pending.splice(0);
      await Promise.all(all);
    },
  };
}
