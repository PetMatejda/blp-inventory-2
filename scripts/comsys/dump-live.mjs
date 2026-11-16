// Reads the live Firestore collections needed for the Comsys delta (read-only).
// Usage: node scripts/comsys/dump-live.mjs <live.json>
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const PROJECT = 'blp-inventory';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const token = execSync('gcloud auth print-access-token', { shell: true }).toString().trim();
const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT };

function plain(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  return null;
}

async function readAll(col) {
  const out = [];
  let pageToken = '';
  do {
    const res = await fetch(`${BASE}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers });
    const json = await res.json();
    if (json.error) throw new Error(`${col}: ${JSON.stringify(json.error)}`);
    for (const d of json.documents || []) {
      out.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, plain(v)])) });
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

const live = {};
for (const col of ['catalog', 'stockLevels', 'stockUnits', 'jobs', 'jobItems', 'movements', 'stocktakes']) {
  live[col] = await readAll(col);
  console.log(col, live[col].length);
}
fs.writeFileSync(process.argv[2], JSON.stringify(live));
