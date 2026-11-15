// Writes an import plan (build-plan.mjs) to the production Firestore with admin
// rights of the signed-in gcloud account (`gcloud auth login`). Existing records
// with the same IDs are replaced; nothing else is touched.
//
// Usage: node scripts/zapsklad/upload.mjs <plan.json> [--dry-run]
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [, , planFile, flag] = process.argv;
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const PROJECT = 'blp-inventory';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;

function value(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: fields(v) } };
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, value(v)]));

const now = new Date().toISOString();
const writes = [];
for (const col of ['catalog', 'stockLevels', 'stockUnits', 'movements']) {
  for (const rec of plan[col] || []) writes.push({ update: { name: `${ROOT}/${col}/${rec.id}`, fields: fields(rec) } });
}
const auditId = `zs-import-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
writes.push({ update: { name: `${ROOT}/auditLogs/${auditId}`, fields: fields({
  id: auditId, timestamp: now, user: 'Import ZapSklad', jobId: '', type: 'add', action: 'Import skladu',
  detail: `Ze ZapSkladu (${plan.source}): ${plan.catalog.length} položek katalogu, ${plan.stockUnits.length} kusů se štítkem`,
}) } });

console.log(`${writes.length} writes:`, Object.fromEntries(['catalog', 'stockLevels', 'stockUnits', 'movements'].map((c) => [c, (plan[c] || []).length])));
if (flag === '--dry-run') process.exit(0);

const token = execSync('gcloud auth print-access-token', { shell: true }).toString().trim();
const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };
for (let i = 0; i < writes.length; i += 400) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:batchWrite`, {
    method: 'POST', headers, body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  const failed = (json.status || []).filter((s) => s.code);
  if (failed.length) throw new Error(`${failed.length} writes failed: ${JSON.stringify(failed[0])}`);
  console.log(`written ${Math.min(i + 400, writes.length)} / ${writes.length}`);
}
