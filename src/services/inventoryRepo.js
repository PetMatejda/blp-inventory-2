// Firestore data layer: one document per record.
//
//   jobs/{id}  jobItems/{id}  catalog/{id}  consumables/{id}  auditLogs/{id}  photos/{id}
//
// Writes are not awaited by the UI. With the persistent cache they apply locally
// at once (listeners fire immediately), are queued while offline and are sent
// when the device is back online — no custom sync, merge or tombstones needed.
import {
  db, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit, waitForPendingWrites,
} from './firebase.js';

export const COLLECTIONS = ['jobs', 'jobItems', 'catalog', 'consumables', 'auditLogs'];
export const AUDIT_LIMIT = 300;

/** Firestore rejects `undefined` values. */
const stripUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export function createFirestoreRepo({ onWriteError = () => {} } = {}) {
  const guard = (promise, what) => promise.catch((err) => {
    console.error(`[Repo] ${what} failed:`, err);
    onWriteError(err, what);
  });

  return {
    newId(col) {
      return doc(collection(db, col)).id;
    },

    set(col, id, data) {
      return guard(setDoc(doc(db, col, id), stripUndefined(data)), `set ${col}/${id}`);
    },

    update(col, id, patch) {
      return guard(updateDoc(doc(db, col, id), stripUndefined(patch)), `update ${col}/${id}`);
    },

    remove(col, id) {
      return guard(deleteDoc(doc(db, col, id)), `delete ${col}/${id}`);
    },

    /** Several writes that must land together. ops: [{ type, col, id, data }] */
    commit(ops) {
      const batch = writeBatch(db);
      for (const op of ops) {
        const ref = doc(db, op.col, op.id);
        if (op.type === 'set') batch.set(ref, stripUndefined(op.data));
        else if (op.type === 'update') batch.update(ref, stripUndefined(op.data));
        else if (op.type === 'delete') batch.delete(ref);
      }
      return guard(batch.commit(), `batch of ${ops.length}`);
    },

    /** Resolves when all queued local writes reached the server (needs a connection). */
    waitForSync() {
      return waitForPendingWrites(db);
    },

    /**
     * Live listeners for all collections.
     * onData(col, records, { pending, fromCache }) — pending = local writes not yet on the server.
     */
    subscribe(onData, onError = () => {}) {
      const unsubs = COLLECTIONS.map((col) => {
        const source = col === 'auditLogs'
          ? query(collection(db, col), orderBy('timestamp', 'desc'), limit(AUDIT_LIMIT))
          : collection(db, col);
        return onSnapshot(
          source,
          { includeMetadataChanges: true },
          (snap) => onData(
            col,
            snap.docs.map((d) => ({ ...d.data(), id: d.id })),
            { pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache },
          ),
          (err) => onError(col, err),
        );
      });
      return () => unsubs.forEach((u) => u());
    },

    /** Live listener for one document (e.g. the migration marker). */
    watchDoc(col, id, onData, onError = () => {}) {
      return onSnapshot(doc(db, col, id), (snap) => onData(snap.exists() ? snap.data() : null), onError);
    },
  };
}
