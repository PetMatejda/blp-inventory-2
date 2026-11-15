// Attendance (collection `attendance`): everyone writes only their own records,
// everyone approved can read all of them (firestore.rules). Rules: src/domain/attendance.js.
import { validateEntry, cleanEntry } from '../domain/attendance.js';

/** @param getUser () => { id, name, email } of the signed-in person */
export function createAttendanceActions({ repo, getState, getUser }) {
  const now = () => new Date().toISOString();
  const all = () => getState().attendance || [];
  const mineOn = (uid, date) => all().filter((r) => r.uid === uid && r.date === date);

  return {
    /** Create or correct one record. Returns { error } or { record }. */
    saveEntry(entry) {
      const user = getUser();
      if (!user?.id) return { error: 'Nejste přihlášeni.' };
      const old = entry.id ? all().find((r) => r.id === entry.id) : null;
      if (entry.id && !old) return { error: 'Záznam už neexistuje.' };
      if (old && old.uid !== user.id) return { error: 'Cizí záznam nejde upravit.' };

      const error = validateEntry(entry, mineOn(user.id, entry.date));
      if (error) return { error };

      const id = old?.id || repo.newId('attendance');
      const record = {
        id,
        uid: user.id,
        userName: user.name || user.email || '',
        email: user.email || '',
        ...cleanEntry(entry),
        createdAt: old?.createdAt || now(),
        updatedAt: now(),
      };
      repo.set('attendance', id, record);
      return { record };
    },

    /** Returns { error } or { record } (the deleted one, for undo). */
    deleteEntry(id) {
      const user = getUser();
      const record = all().find((r) => r.id === id);
      if (!record) return { error: 'Záznam už neexistuje.' };
      if (record.uid !== user?.id) return { error: 'Cizí záznam nejde smazat.' };
      repo.remove('attendance', id);
      return { record };
    },

    /** The same entry for several days at once (days that already have a record are skipped). */
    fillDays(dates, template) {
      const user = getUser();
      if (!user?.id) return { error: 'Nejste přihlášeni.', saved: 0 };
      const ops = [];
      for (const date of [...new Set(dates)]) {
        if (mineOn(user.id, date).length || validateEntry({ ...template, date })) continue;
        const id = repo.newId('attendance');
        ops.push({ type: 'set', col: 'attendance', id, data: {
          id, uid: user.id, userName: user.name || user.email || '', email: user.email || '',
          ...cleanEntry({ ...template, date }), createdAt: now(), updatedAt: now(),
        } });
      }
      if (ops.length) repo.commit(ops);
      return { saved: ops.length };
    },
  };
}
