// Writes a delta plan (build-delta.mjs) to the production Firestore in ONE atomic
// commit, with admin rights of the signed-in gcloud account. Without --confirm it
// only prints what it would do.
//
// Usage: node scripts/comsys/apply.mjs <plan.json> [--confirm]
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

const writes = plan.ops.map((o) => {
  const name = `${ROOT}/${o.col}/${o.id}`;
  if (o.op === 'set') return { update: { name, fields: fields(o.data) } };
  if (o.op === 'delete') return { delete: name };
  if (o.op === 'update') { // only the listed fields; the record must exist
    return { update: { name, fields: fields(o.data) }, updateMask: { fieldPaths: Object.keys(o.data) }, currentDocument: { exists: true } };
  }
  if (o.op === 'increment') {
    return {
      update: { name, fields: fields(o.stamp || {}) }, updateMask: { fieldPaths: Object.keys(o.stamp || {}) }, currentDocument: { exists: true },
      updateTransforms: Object.entries(o.data).map(([fieldPath, n]) => ({ fieldPath, increment: value(n) })),
    };
  }
  throw new Error(`Unknown op ${o.op}`);
});

const summary = {};
for (const o of plan.ops) summary[`${o.col} ${o.op}`] = (summary[`${o.col} ${o.op}`] || 0) + 1;
console.log(`${plan.source}, plan from ${plan.createdAt}: ${writes.length} writes`, summary);

const ageMin = (Date.now() - new Date(plan.createdAt)) / 60000;
if (flag !== '--confirm') { console.log('Dry run – nothing written. Add --confirm to write.'); process.exit(0); }
if (ageMin > 60) throw new Error('The plan is older than an hour – read the live data and build it again.');

const token = execSync('gcloud auth print-access-token', { shell: true }).toString().trim();
const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
const json = await res.json();
if (json.error) throw new Error(`Nothing was written: ${JSON.stringify(json.error)}`);
console.log(`written ${json.writeResults.length} / ${writes.length} at ${json.commitTime}`);
