// One-off: the company fleet from the whiteboard (15. 11. 2026) into `vehicles`.
// Admin write via `gcloud auth print-access-token`. Usage: node scripts/seed-vehicles.mjs [--dry-run]
import { execSync } from 'node:child_process';

const now = new Date().toISOString();
const by = 'Založení vozového parku';
const V = (order, id, name, model, plate, color, extra, stkDue, vignetteDue, note = '') => ({
  id, order, name, model, plate, color, ...extra, stkDue, vignetteDue, note, active: true, createdAt: now, updatedAt: now, updatedBy: by,
});
const vehicles = [
  V(1, 'veh-9an8877', 'Sprinter černý', 'Mercedes Sprinter', '9AN 8877', 'černá', {}, '2027-01', '2027-04-21'),
  V(2, 'veh-1ahr754', 'Sprinter bílý', 'Mercedes Sprinter', '1AH R754', 'bílá', {}, '2029-01', '2027-10-17', 'SPZ ověřit'),
  V(3, 'veh-9p55481', 'Transporter automat', 'VW Transporter', '9P5 5481', 'bílá', { transmission: 'automat' }, '2028-08', '2027-10-17'),
  V(4, 'veh-8p96375', 'Transporter manuál', 'VW Transporter', '8P9 6375', 'bílá', { transmission: 'manuál' }, '2027-02', '2027-03-23', 'SPZ ověřit'),
  V(5, 'veh-6sx7540', 'Bigster', 'Dacia Bigster', '6SX 7540', '', { transmission: 'automat', fuel: 'elektro / LPG' }, '2030-03', '2027-04-21', 'Na tabuli: EL/NATUR — palivo ověřit'),
  V(6, 'veh-5st3525', 'Jogger', 'Dacia Jogger', '5ST 3525', 'cihlová', {}, '2028-05', '2027-07-26'),
  V(7, 'veh-6p71711', 'Viano', 'Mercedes Viano', '6P7 1711', 'černá', {}, '2027-09', '2027-04-28', 'Datum dálniční známky ověřit (na tabuli nečitelné)'),
  V(8, 'veh-1art457', 'Mercedes T180', 'Mercedes T180', '1AR T457', 'šedá', {}, '2030-09', '2027-09-06'),
];

const value = (v) => typeof v === 'boolean' ? { booleanValue: v } : Number.isInteger(v) ? { integerValue: String(v) } : { stringValue: String(v) };
const ROOT = 'projects/blp-inventory/databases/(default)/documents';
const auditId = `veh-seed-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
const writes = [
  ...vehicles.map((v) => ({ update: { name: `${ROOT}/vehicles/${v.id}`, fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } })),
  { update: { name: `${ROOT}/auditLogs/${auditId}`, fields: Object.fromEntries(Object.entries({
    id: auditId, timestamp: now, user: by, jobId: '', type: 'add', action: 'Vozidla – přidání',
    detail: `Založen vozový park: ${vehicles.map((v) => v.plate).join(', ')}`,
  }).map(([k, x]) => [k, value(x)])) } },
];
console.log(vehicles.map((v) => `${v.plate}  ${v.name}  STK ${v.stkDue}  známka ${v.vignetteDue}`).join('\n'));
if (process.argv[2] === '--dry-run') process.exit(0);
const token = execSync('gcloud auth print-access-token', { shell: true }).toString().trim();
const res = await fetch('https://firestore.googleapis.com/v1/projects/blp-inventory/databases/(default)/documents:batchWrite', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': 'blp-inventory', 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
const json = await res.json();
if (json.error || (json.status || []).some((s) => s.code)) throw new Error(JSON.stringify(json.error || json.status));
console.log(`written ${writes.length}`);
