// Company vehicles: STK (technical inspection) and motorway vignette deadlines.
// Pure functions, no storage (see ANALYZA_AUTA_A_IMPORT_SKLADU.md, chapter 1).
//
// Deadlines are stored as 'YYYY-MM' (month, as on the STK sticker) or 'YYYY-MM-DD'.
// A month-only deadline counts until the last day of that month.

export const DEADLINES = {
  stk: { field: 'stkDue', label: 'STK', warnDays: 60 },
  vignette: { field: 'vignetteDue', label: 'Dálniční známka', short: 'Známka', warnDays: 30 },
};
export const DANGER_DAYS = 7;

// Kind of vehicle (decides the icon): truck = nákladní (Sprinter), van = firemní
// MPV (Viano, Transporter), car = osobní (Dacia, Mercedes T).
export const VEHICLE_KINDS = [
  { id: 'truck', label: 'Nákladní' },
  { id: 'van', label: 'Van' },
  { id: 'car', label: 'Osobní' },
];
const KIND_HINTS = {
  truck: /sprinter|crafter|ducato|boxer|jumper|master|movano|daily|iveco|transit(?! (custom|connect|courier))|naklad|dodavk/,
  van: /viano|vito|v-class|trida v|transporter|multivan|caravelle|trafic|vivaro|tourneo|transit custom|\bvan\b|\bmpv\b/,
};
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** The kind set on the vehicle, otherwise guessed from its model and name; unknown = car. */
export function vehicleKind(vehicle) {
  if (VEHICLE_KINDS.some((k) => k.id === vehicle?.kind)) return vehicle.kind;
  const text = plain(`${vehicle?.model || ''} ${vehicle?.name || ''}`);
  if (KIND_HINTS.van.test(text)) return 'van';
  if (KIND_HINTS.truck.test(text)) return 'truck';
  return 'car';
}

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Local calendar day as 'YYYY-MM-DD'. */
export const todayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** 'YYYY-MM' → last day of the month, 'YYYY-MM-DD' → itself, anything else → ''. */
export function dueDate(value) {
  const v = String(value || '').trim();
  let m = v.match(/^(\d{4})-(\d{2})$/);
  if (m) return isoDay(new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)));
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? v : '';
}

/** Whole days from `today` to `date` (negative = in the past). */
export const daysBetween = (today, date) => Math.round((utc(date) - utc(today)) / 86400000);

/** '2027-01' → '1/2027', '2027-04-21' → '21. 4. 2027'. */
export function formatDue(value) {
  const v = String(value || '').trim();
  let m = v.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${Number(m[2])}/${m[1]}`;
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : '';
}

const inDays = (n) => (n === 0 ? 'dnes' : n === 1 ? 'zítra' : `za ${n} ${n < 5 ? 'dny' : 'dní'}`);
const agoDays = (n) => (n === 1 ? 'včera' : `před ${n} dny`);

/**
 * State of one deadline.
 * level: 'none' (not entered) | 'ok' | 'warn' | 'danger' (≤ 7 days) | 'expired'
 * `until` (job end date): a deadline that runs out before it is at least 'warn'.
 */
export function deadlineStatus(kind, value, today, { until } = {}) {
  const def = DEADLINES[kind];
  const due = dueDate(value);
  if (!due) return { kind, label: def.label, level: 'none', due: '', days: null, text: `${def.short || def.label}: nezadáno` };
  const days = daysBetween(today, due);
  let level = days < 0 ? 'expired' : days <= DANGER_DAYS ? 'danger' : days <= def.warnDays ? 'warn' : 'ok';
  const duringJob = !!until && days >= 0 && due < until;
  if (duringJob && level === 'ok') level = 'warn';
  const name = def.short || def.label;
  const text = level === 'expired' ? `${name} propadlá ${agoDays(-days)}`
    : level === 'ok' ? `${name} do ${formatDue(value)}`
      : duringJob && level === 'warn' && days > def.warnDays ? `${name} skončí během zakázky (${formatDue(value)})`
        : `${name} ${inDays(days)}`;
  return { kind, label: def.label, level, due, days, text, duringJob };
}

const RANK = { expired: 4, danger: 3, warn: 2, ok: 1, none: 0 };
export const worstLevel = (statuses) => statuses.reduce((w, s) => (RANK[s.level] > RANK[w] ? s.level : w), 'none');

/** Both deadlines of a vehicle. */
export const vehicleDeadlines = (vehicle, today, opts) =>
  Object.keys(DEADLINES).map((kind) => deadlineStatus(kind, vehicle?.[DEADLINES[kind].field], today, opts));

/** Deadlines that need attention (warn, danger, expired). */
export const vehicleAlerts = (vehicle, today, opts) =>
  vehicleDeadlines(vehicle, today, opts).filter((s) => RANK[s.level] >= RANK.warn);

/** Active vehicles with something to do, most urgent first. */
export function fleetAlerts(vehicles, today) {
  return (vehicles || [])
    .filter((v) => v.active !== false)
    .map((vehicle) => ({ vehicle, alerts: vehicleAlerts(vehicle, today) }))
    .filter((x) => x.alerts.length)
    .sort((a, b) => Math.min(...a.alerts.map((s) => s.days)) - Math.min(...b.alerts.map((s) => s.days)));
}

/** 'gsx7540' → '6SX 7540'-style: upper case, single spaces. */
export const normalizePlate = (plate) => String(plate || '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Accepts 'M/YYYY', 'MM/YYYY', 'YYYY-MM' and 'D. M. YYYY', 'YYYY-MM-DD' → stored form, or null when invalid. */
export function parseDueInput(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  let m = v.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${pad(m[1])}`;
  m = v.match(/^(\d{4})-(\d{2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return v;
  m = v.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${pad(m[2])}-${pad(m[1])}`;
    return isoDay(new Date(utc(iso))) === iso ? iso : null;
  }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return isoDay(new Date(utc(v))) === v ? v : null;
  return null;
}

/** Error message for the vehicle form, or '' when it can be saved. */
export function validateVehicle(data, vehicles = [], selfId = null) {
  const plate = normalizePlate(data.plate);
  if (!plate) return 'Zadejte SPZ.';
  if (!String(data.name || '').trim()) return 'Zadejte název vozu.';
  if (vehicles.some((v) => v.id !== selfId && normalizePlate(v.plate) === plate)) return `Vůz se SPZ ${plate} už existuje.`;
  return '';
}

/** Label used in pickers and the handover protocol. */
export const vehicleLabel = (v) => (v ? [v.name, v.plate && `(${v.plate})`].filter(Boolean).join(' ') : '');
