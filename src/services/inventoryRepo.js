// Firestore data layer: one document per record.
//
//   jobs  jobItems  catalog  consumables  auditLogs  photos
//   stockLevels/{catalogId}  stockUnits  movements  stocktakes  stocktakeLines
//   vehicles  attendance (docházka; everyone writes only their own records)
//   gameScores, quizScores, flatScores (leaderboards of the games; own records only, see src/domain/gameScores.js)
//
// Writes are not awaited by the UI. With the persistent cache they apply locally
// at once (listeners fire immediately), are queued while offline and are sent
// when the device is back online — no custom sync, merge or tombstones needed.
//
// Field markers for conflict-free updates (several people at once, offline too):
//   { __inc: n }        → increment(n)      (stock counts)
//   { __union: [...] }  → arrayUnion(...)   (scanned units in a stocktake)
//   { __remove: [...] } → arrayRemove(...)
import {
  db, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit, where, waitForPendingWrites, increment, arrayUnion, arrayRemove,
} from './firebase.js';
import { previousWeekId } from '../domain/gameScores.js';

export const COLLECTIONS = [
  'jobs', 'jobItems', 'catalog', 'consumables', 'auditLogs',
  'stockLevels', 'stockUnits', 'movements', 'stocktakes', 'stocktakeLines',
  'vehicles', 'attendance', 'gameScores', 'quizScores', 'flatScores',
];
export const AUDIT_LIMIT = 300;
export const MOVEMENTS_LIMIT = 500;
/** Attendance is loaded this many days back (current year overview + browsing a few months). */
export const ATTENDANCE_DAYS = 400;
const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

/** Firestore rejects `undefined`; markers become FieldValues. */
export function toFirestoreData(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('__inc' in v) { out[k] = increment(v.__inc); continue; }
      if ('__union' in v) { out[k] = arrayUnion(...v.__union); continue; }
      if ('__remove' in v) { out[k] = arrayRemove(...v.__remove); continue; }
    }
    out[k] = v;
  }
  return out;
}

const sourceFor = (col) => {
  const ref = collection(db, col);
  if (col === 'auditLogs') return query(ref, orderBy('timestamp', 'desc'), limit(AUDIT_LIMIT));
  if (col === 'movements') return query(ref, orderBy('timestamp', 'desc'), limit(MOVEMENTS_LIMIT));
  if (col === 'stocktakeLines') return query(ref, where('open', '==', true));
  if (col === 'attendance') return query(ref, where('date', '>=', daysAgoIso(ATTENDANCE_DAYS)));
  // Last week, this week and the all-time records ('all' sorts after every '2026-W47').
  if (col.endsWith('Scores')) return query(ref, where('week', '>=', previousWeekId(daysAgoIso(0))));
  return ref;
};

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
      return guard(setDoc(doc(db, col, id), toFirestoreData(data)), `set ${col}/${id}`);
    },

    update(col, id, patch) {
      return guard(updateDoc(doc(db, col, id), toFirestoreData(patch)), `update ${col}/${id}`);
    },

    remove(col, id) {
      return guard(deleteDoc(doc(db, col, id)), `delete ${col}/${id}`);
    },

    /**
     * Several writes that must land together. ops: [{ type, col, id, data }]
     * type: 'set' | 'merge' (set with merge, creates if missing) | 'update' | 'delete'
     */
    commit(ops) {
      const batch = writeBatch(db);
      for (const op of ops) {
        const ref = doc(db, op.col, op.id);
        if (op.type === 'set') batch.set(ref, toFirestoreData(op.data));
        else if (op.type === 'merge') batch.set(ref, toFirestoreData(op.data), { merge: true });
        else if (op.type === 'update') batch.update(ref, toFirestoreData(op.data));
        else if (op.type === 'delete') batch.delete(ref);
      }
      return guard(batch.commit(), `batch of ${ops.length} (${[...new Set(ops.map((o) => o.col))].join(', ')})`);
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
      const unsubs = COLLECTIONS.map((col) => onSnapshot(
        sourceFor(col),
        { includeMetadataChanges: true },
        (snap) => onData(
          col,
          snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          { pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache },
        ),
        (err) => onError(col, err),
      ));
      return () => unsubs.forEach((u) => u());
    },

    /** Live listener for one document (e.g. the migration marker). */
    watchDoc(col, id, onData, onError = () => {}) {
      return onSnapshot(doc(db, col, id), (snap) => onData(snap.exists() ? snap.data() : null), onError);
    },
  };
}
