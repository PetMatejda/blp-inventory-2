// Barcodes of the old Comsys labels → plan for apply.mjs.
//
// A Comsys label prints the evidence number ("000241") but its barcode holds
// "EC" + the internal piece id (column `idevcisla` of the export evcisla_full.xls).
//   labelled unit in the app  → stockUnits.barcode = "EC502"
//   piece tracked by count    → catalog.pieceBarcodes = ["EC12", …] (found through catalog.sourceCodes)
// Records retired in Comsys are skipped. Nothing else changes.
//
// Usage: node scripts/comsys/barcodes.mjs <rows.json> <live.json> <plan.json>
//   rows.json  rows of evcisla_full.xls as objects { idevcisla, evcislo, vyrazeno, zak_nazev, cen_text }
//   live.json  from dump-live.mjs
//   then:      node scripts/comsys/apply.mjs <plan.json> [--confirm]
import fs from 'node:fs';

const [, , rowsFile, liveFile, planFile] = process.argv;
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
const ACTOR = 'Import Comsys';
const now = new Date().toISOString();

const key = (code) => String(code).trim().replace(/^0+/, '') || '0';
const retired = (r) => r.vyrazeno !== '' || /^vy/i.test(r.zak_nazev);
const barcode = (r) => `EC${Number(r.idevcisla)}`;
const plain = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

const unitByCode = new Map(live.stockUnits.map((u) => [key(u.code), u]));
const itemsBySource = new Map();
for (const c of live.catalog) {
  for (const code of String(c.sourceCodes || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    itemsBySource.set(key(code), [...(itemsBySource.get(key(code)) || []), c]);
  }
}

const ops = [];
const pieces = new Map(); // catalogId → barcodes
const problems = [];
const seen = new Set();
for (const r of [...rows].sort((a, b) => a.idevcisla - b.idevcisla)) {
  if (retired(r)) continue;
  const code = barcode(r);
  if (seen.has(code)) { problems.push(`Čárový kód ${code} je v exportu dvakrát.`); continue; }
  seen.add(code);
  const unit = unitByCode.get(key(r.evcislo));
  if (unit) {
    ops.push({ op: 'update', col: 'stockUnits', id: unit.id, data: { barcode: code, updatedAt: now, updatedBy: ACTOR } });
    continue;
  }
  // An evidence number used twice in Comsys can sit in two items: take the one of the same kind.
  let items = itemsBySource.get(key(r.evcislo)) || [];
  if (items.length > 1) items = items.filter((c) => plain(c.name) === plain(r.cen_text));
  if (items.length !== 1) { problems.push(`Ev. č. ${r.evcislo} (${r.cen_text}, ${code}) nemá v aplikaci kus ani jednoznačnou položku.`); continue; }
  pieces.set(items[0].id, [...(pieces.get(items[0].id) || []), code]);
}
for (const [id, codes] of pieces) ops.push({ op: 'update', col: 'catalog', id, data: { pieceBarcodes: codes, updatedAt: now, updatedBy: ACTOR } });

const units = ops.filter((o) => o.col === 'stockUnits').length;
console.log(`kusy se štítkem: ${units}, kusy vedené počtem: ${[...pieces.values()].flat().length} u ${pieces.size} položek`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
fs.writeFileSync(planFile, JSON.stringify({ source: 'Comsys evcisla_full.xls – čárové kódy štítků', createdAt: now, ops }));
