// Attendance (docházka): pure rules shared by the app and the MCP server.
//
// One record = one part of a day of one person:
//   { id, uid, userName, date: 'YYYY-MM-DD', type, from: 'HH:MM', to: 'HH:MM', note }
// Work types carry times; absences (Volno M, Dovolená, Nemoc) cover the whole day.
// A day split between two jobs (½ sklad, ½ točba) is simply two records.
// The monthly numbers follow the crew overview used so far:
//   norm = working days × 8 h − 8 h for every day of holiday (dovolená).

export const ATTENDANCE_TYPES = [
  { id: 'TOCBA', label: 'Točba', work: true, onJob: true, color: '#2a78d6' },
  { id: 'RIGGING', label: 'Rigging', work: true, onJob: true, color: '#eb6834' },
  { id: 'TRAVEL', label: 'Travel', work: true, onJob: true, color: '#1baf7a' },
  { id: 'SKLAD', label: 'Sklad', work: true, onJob: false, color: '#c98500' },
  { id: 'VOLNO', label: 'Volno M', work: false, color: '#008300' },
  { id: 'DOVOLENA', label: 'Dovolená', work: false, color: '#d55181' },
  { id: 'NEMOC', label: 'Nemoc', work: false, color: '#4a3aa7' },
];
export const WORK_TYPES = ATTENDANCE_TYPES.filter((t) => t.work);
export const ABSENCE_TYPES = ATTENDANCE_TYPES.filter((t) => !t.work);
export const typeOf = (id) => ATTENDANCE_TYPES.find((t) => t.id === id) || null;
export const DAY_HOURS = 8;

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (year, month) => `${year}-${pad(month)}`; // month 1–12
export const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Easter Sunday (Gregorian), used for Good Friday and Easter Monday. */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const FIXED_HOLIDAYS = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'];

/** Czech public holiday? (date: 'YYYY-MM-DD') */
export function isHoliday(date) {
  if (FIXED_HOLIDAYS.includes(date.slice(5))) return true;
  const easter = easterSunday(Number(date.slice(0, 4)));
  const shift = (days) => isoDate(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + days));
  return date === shift(-2) || date === shift(1);
}

export function isWeekend(date) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6;
}
export const isWorkday = (date) => !isWeekend(date) && !isHoliday(date);

/** All days of a month as 'YYYY-MM-DD' (month 1–12). */
export function daysOfMonth(year, month) {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${monthKey(year, month)}-${pad(i + 1)}`);
}

/** Hours of one record. Absences count 0; a shift over midnight is supported. */
export function hoursOf(record) {
  if (!typeOf(record.type)?.work || !isTime(record.from) || !isTime(record.to)) return 0;
  let diff = minutes(record.to) - minutes(record.from);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

const overlaps = (a, b) => {
  const [a1, a2] = [minutes(a.from), minutes(a.to) <= minutes(a.from) ? minutes(a.to) + 1440 : minutes(a.to)];
  const [b1, b2] = [minutes(b.from), minutes(b.to) <= minutes(b.from) ? minutes(b.to) + 1440 : minutes(b.to)];
  return a1 < b2 && b1 < a2;
};

/**
 * Checks one entry against the person's other records of the same day.
 * Returns a Czech error message or null.
 */
export function validateEntry(entry, sameDay = []) {
  const type = typeOf(entry.type);
  if (!isIsoDate(entry.date)) return 'Vyberte datum.';
  if (!type) return 'Vyberte, co jste dělali.';
  const others = sameDay.filter((r) => r.id !== entry.id);
  if (!type.work) {
    return others.length ? 'Na tento den už je jiný záznam. Nepřítomnost platí na celý den – nejdřív ho smažte.' : null;
  }
  if (!isTime(entry.from) || !isTime(entry.to)) return 'Vyplňte čas od–do.';
  if (entry.from === entry.to) return 'Čas od a do nemůže být stejný.';
  if (hoursOf(entry) > 20) return 'Směna delší než 20 hodin – zkontrolujte časy.';
  if (others.some((r) => !typeOf(r.type)?.work)) return 'Na tento den je zapsaná nepřítomnost. Nejdřív ji smažte.';
  if (others.some((r) => overlaps(entry, r))) return 'Čas se překrývá s jiným záznamem toho dne.';
  return null;
}

/** Clean record for storing (only known fields; absences have no times). */
export function cleanEntry(entry) {
  const work = !!typeOf(entry.type)?.work;
  return {
    date: entry.date,
    type: entry.type,
    from: work ? entry.from : '',
    to: work ? entry.to : '',
    note: String(entry.note || '').trim().slice(0, 200),
  };
}

const emptyDays = () => Object.fromEntries(ATTENDANCE_TYPES.map((t) => [t.id, 0]));

/**
 * One person's month. records: that person's records (any dates).
 * Days are split evenly between the records of a day (two records = ½ + ½).
 * `missing` = working days up to `today` (not including it) with no record.
 */
export function monthSummary(records, year, month, { today = isoDate(new Date()) } = {}) {
  const key = monthKey(year, month);
  const mine = records.filter((r) => String(r.date || '').startsWith(key));
  const byDate = {};
  for (const r of mine) (byDate[r.date] ||= []).push(r);

  const days = emptyDays();
  let hours = 0;
  for (const list of Object.values(byDate)) {
    for (const r of list) {
      if (days[r.type] !== undefined) days[r.type] += 1 / list.length;
      hours += hoursOf(r);
    }
  }
  const allDays = daysOfMonth(year, month);
  const workdays = allDays.filter(isWorkday).length;
  const norm = Math.max(0, workdays * DAY_HOURS - days.DOVOLENA * DAY_HOURS);
  const missing = allDays.filter((d) => d < today && isWorkday(d) && !byDate[d]);
  const round = (n) => Math.round(n * 100) / 100;
  return {
    month: key,
    hours: round(hours),
    norm: round(norm),
    diff: round(hours - norm),
    workdays,
    days: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, round(v)])),
    jobDays: round(days.TOCBA + days.RIGGING + days.TRAVEL),
    filledDays: Object.keys(byDate).length,
    missing,
    byDate,
  };
}

/** Everyone's month, sorted by name: [{ uid, userName, ...monthSummary }]. */
export function teamMonth(records, year, month, options) {
  const people = new Map();
  for (const r of records) {
    if (!r.uid) continue;
    if (!people.has(r.uid)) people.set(r.uid, { uid: r.uid, userName: r.userName || '', records: [] });
    const p = people.get(r.uid);
    p.records.push(r);
    if (r.userName && String(r.updatedAt || '') >= String(p.nameAt || '')) { p.userName = r.userName; p.nameAt = r.updatedAt || ''; }
  }
  return [...people.values()]
    .map((p) => ({ uid: p.uid, userName: p.userName || 'Bez jména', ...monthSummary(p.records, year, month, options) }))
    .filter((p) => p.filledDays > 0)
    .sort((a, b) => a.userName.localeCompare(b.userName, 'cs'));
}

/** Times to offer for a new work entry: the person's latest work record, else 8–16. */
export function defaultTimes(records) {
  const last = records.filter((r) => typeOf(r.type)?.work && isTime(r.from) && isTime(r.to))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  return last ? { from: last.from, to: last.to, type: last.type } : { from: '08:00', to: '16:00', type: 'SKLAD' };
}

export const fmtHours = (h) => `${(Math.round(h * 10) / 10).toLocaleString('cs-CZ')} h`;
export const fmtDays = (d) => (Math.round(d * 10) / 10).toLocaleString('cs-CZ');
