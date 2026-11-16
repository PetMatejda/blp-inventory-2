// Compares the Comsys report (rows from read_xls.py) with the live data (dump-live.mjs)
// and writes a delta plan plus a readable preview. Nothing is written to Firestore here.
//
// Usage: node scripts/comsys/build-delta.mjs <rows.json> <live.json> <plan.json> <preview.md>
//
// Rules agreed with Petr (16 Nov 2026):
//  - everything is in the warehouse (the job column in Comsys is out of date),
//  - what the export does not contain is deleted from the app,
//  - notes are turned into fields (condition, LED, maker's number, note),
//  - no prices, no recurring sync.
import fs from 'node:fs';
import { parseNote } from './notes.mjs';

const [, , rowsFile, liveFile, planFile, previewFile] = process.argv;
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
const SOURCE = 'Comsys export 11-2026';
const ACTOR = 'Import Comsys';
const now = new Date().toISOString();

const norm = (code) => String(code).replace(/^0+/, '') || '0';
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const count = (arr, key) => arr.reduce((m, x) => m.set(key(x), (m.get(key(x)) || 0) + 1), new Map());
const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

const catalogById = new Map(live.catalog.map((c) => [c.id, c]));
const levelById = new Map(live.stockLevels.map((l) => [l.id, l]));
const unitByCode = new Map(live.stockUnits.map((u) => [norm(u.code), u]));
const total = (l) => (l ? (l.inStock || 0) + (l.onJob || 0) + (l.inService || 0) + (l.missing || 0) : 0);

// ── models that only exist in Comsys (kind number → new catalog item) ──
const NEW_MODELS = {
  '000219': { name: 'Underwater Lamp INTECA', category: 'Lights', icon: 'lightbulb', serialPrefix: 'UWL', brand: 'Inteca' },
  '000221': { name: 'Cloud 6x6x1,3 m blacktop', category: 'Lights', icon: 'cloud', serialPrefix: 'BAL', size: '6x6x1,3 m' },
};

// ── which model does each row belong to ──────────────────────────────
const codeModel = new Map(); // inventory number → model it has in the app
for (const u of live.stockUnits) codeModel.set(norm(u.code), u.catalogId);
for (const c of live.catalog) {
  for (const code of String(c.sourceCodes || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!codeModel.has(norm(code))) codeModel.set(norm(code), c.id);
  }
}
for (const r of rows) r.appModel = codeModel.get(norm(r.ev)) || null;

// A model belongs to the Comsys kind (Zn) that holds most of its pieces.
const znOfModel = new Map();
for (const [model, perZn] of [...count(rows.filter((r) => r.appModel), (r) => `${r.appModel}|${r.zn}`)]
  .reduce((m, [k, n]) => { const [model, zn] = k.split('|'); (m.get(model) || m.set(model, new Map()).get(model)).set(zn, n); return m; }, new Map())) {
  znOfModel.set(model, top(perZn));
}
const primaryOfZn = new Map();
for (const zn of new Set(rows.map((r) => r.zn))) {
  const known = count(rows.filter((r) => r.zn === zn && r.appModel), (r) => r.appModel);
  if (known.size) primaryOfZn.set(zn, top(known));
}

const problems = [];
const newCatalog = new Map();
for (const r of rows) {
  // A piece keeps its model unless that model clearly belongs to another Comsys kind
  // (the app splits some kinds into several models and merges others – both are fine).
  if (r.appModel && (znOfModel.get(r.appModel) === r.zn || primaryOfZn.get(r.zn) === r.appModel)) { r.model = r.appModel; continue; }
  let target = primaryOfZn.get(r.zn);
  if (!target) {
    const def = NEW_MODELS[r.zn];
    if (!def) { problems.push(`Neznámý druh ${r.zn} „${r.text}“ (ev. č. ${r.ev}) – chybí přiřazení k modelu.`); continue; }
    target = `cs-${slug(def.name)}`;
    if (!newCatalog.has(target)) newCatalog.set(target, def);
  }
  r.model = target;
  if (r.appModel) r.movedFrom = r.appModel;
}

// ── build the plan ───────────────────────────────────────────────────
const ops = [];
const pv = { newModels: [], added: [], moved: [], deletedUnits: [], deletedModels: [], counts: [], unitChanges: [], quantityNotes: [], attention: [] };
const nameOf = (id) => catalogById.get(id)?.name || newCatalog.get(id)?.name || id;
const byModel = new Map();
for (const r of rows) if (r.model) (byModel.get(r.model) || byModel.set(r.model, []).get(r.model)).push(r);

const usedByJobs = count(live.jobItems, (i) => i.catalogId);

for (const [id, list] of [...byModel].sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0]), 'cs'))) {
  const cat = catalogById.get(id);
  const def = newCatalog.get(id);
  const tracking = cat ? cat.trackingType : 'SERIAL';
  const target = list.length;
  const before = total(levelById.get(id));
  const zns = [...new Set(list.map((r) => r.zn))].sort();
  const codes = list.map((r) => norm(r.ev)).sort((a, b) => a - b).join(', ');

  if (cat) {
    ops.push({ op: 'update', col: 'catalog', id, data: { availableCount: target, sourceCodes: codes, comsysZn: zns, updatedAt: now, updatedBy: ACTOR } });
  } else {
    const leds = list.map((r) => parseNote(r.note).led).filter((v) => v !== undefined);
    ops.push({ op: 'set', col: 'catalog', id, data: {
      id, name: def.name, category: def.category, icon: def.icon, weight: '', power: '', size: def.size || '', brand: def.brand || '', usage: '',
      ...(leds.length ? { led: leds.some(Boolean) } : {}),
      image: '', barcode: '', serialPrefix: def.serialPrefix, trackingType: 'SERIAL', availableCount: target, isBundle: false, bundleItems: [],
      source: SOURCE, sourceCodes: codes, comsysZn: zns, createdAt: now, updatedAt: now, updatedBy: ACTOR,
    } });
    ops.push({ op: 'set', col: 'stockLevels', id, data: { id, catalogId: id, inStock: target, onJob: 0, inService: 0, missing: 0, updatedAt: now, updatedBy: ACTOR } });
    pv.newModels.push({ name: def.name, n: target, codes: list.map((r) => r.ev).join(', ') });
  }

  if (cat && target !== before) {
    ops.push({ op: 'increment', col: 'stockLevels', id, data: { inStock: target - before }, stamp: { updatedAt: now, updatedBy: ACTOR } });
    pv.counts.push({ name: cat.name, before, target });
  }
  if (!cat || target !== before) {
    const diff = target - before;
    ops.push({ op: 'set', col: 'movements', id: `cs-2611-${id}`, data: {
      id: `cs-2611-${id}`, type: diff > 0 ? 'RECEIPT' : 'RETIRE', label: diff > 0 ? 'Příjem na sklad' : 'Vyřazení',
      catalogId: id, itemName: nameOf(id), qty: Math.abs(diff), timestamp: now, user: ACTOR, note: `Srovnání s Comsysem (${SOURCE})`,
    } });
  }

  for (const r of list) {
    const mined = parseNote(r.note);
    const fields = {
      ...(mined.condition ? { condition: mined.condition } : {}),
      ...(mined.led !== undefined ? { led: mined.led } : {}),
      ...(mined.serialNumber ? { serialNumber: mined.serialNumber } : {}),
      ...(mined.note ? { note: mined.note } : {}),
    };
    if (/oprav|nefunk|rozbit/i.test(r.note)) pv.attention.push({ ev: r.ev, name: nameOf(id), note: mined.note || r.note });
    if (tracking !== 'SERIAL') {
      if (Object.keys(fields).length) pv.quantityNotes.push({ ev: r.ev, name: nameOf(id), note: r.note.replace(/\n/g, ' / ') });
      continue;
    }
    const unit = unitByCode.get(norm(r.ev));
    // A maker's number that cannot be read reliably never replaces a good one.
    if (mined.serialUnclear && !/^\d+\/\d{4}$/.test(unit?.serialNumber || '')) {
      fields.note = [fields.note, `v. č. ${mined.serialUnclear}`].filter(Boolean).join(', ');
    }
    if (!unit) {
      const code = norm(r.ev);
      ops.push({ op: 'set', col: 'stockUnits', id: `zs-${code}`, data: {
        id: `zs-${code}`, catalogId: id, code, serialNumber: code, status: 'IN_STOCK', ...fields, createdAt: now, updatedAt: now, updatedBy: ACTOR,
      } });
      pv.added.push({ ev: r.ev, name: nameOf(id), fields, inserted: r.inserted });
      continue;
    }
    const change = {};
    if (unit.catalogId !== id) {
      change.catalogId = id;
      pv.moved.push({ ev: r.ev, from: nameOf(unit.catalogId), to: nameOf(id) });
    }
    const same = (a, b) => a === b || (typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase());
    for (const [k, v] of Object.entries(fields)) if (!same(unit[k], v)) change[k] = v;
    if (Object.keys(change).length) {
      ops.push({ op: 'update', col: 'stockUnits', id: unit.id, data: { ...change, updatedAt: now, updatedBy: ACTOR } });
      const shown = Object.entries(change).filter(([k]) => k !== 'catalogId');
      if (shown.length) pv.unitChanges.push({ ev: r.ev, name: nameOf(id), change: Object.fromEntries(shown.map(([k, v]) => [k, [unit[k], v]])) });
    }
    unit.kept = true;
  }
}

// Pieces counted (not labelled) that Comsys keeps under another model.
for (const r of rows) {
  if (r.movedFrom && catalogById.get(r.model)?.trackingType !== 'SERIAL') pv.moved.push({ ev: r.ev, from: nameOf(r.movedFrom), to: nameOf(r.model) });
}

// ── what the export does not contain ─────────────────────────────────
for (const u of live.stockUnits) {
  if (u.kept || !byModel.has(u.catalogId)) continue; // units of deleted models go with the model
  ops.push({ op: 'delete', col: 'stockUnits', id: u.id });
  pv.deletedUnits.push({ code: u.code, name: nameOf(u.catalogId), note: [u.condition && `stav ${u.condition}`, u.note].filter(Boolean).join(', ') });
}
for (const c of live.catalog) {
  if (byModel.has(c.id)) continue;
  const n = total(levelById.get(c.id));
  const units = live.stockUnits.filter((u) => u.catalogId === c.id);
  ops.push({ op: 'delete', col: 'catalog', id: c.id });
  ops.push({ op: 'delete', col: 'stockLevels', id: c.id });
  for (const u of units) ops.push({ op: 'delete', col: 'stockUnits', id: u.id });
  ops.push({ op: 'set', col: 'movements', id: `cs-2611-${c.id}`, data: {
    id: `cs-2611-${c.id}`, type: 'RETIRE', label: 'Vyřazení', catalogId: c.id, itemName: c.name, qty: n, timestamp: now, user: ACTOR,
    note: `Není v Comsysu (${SOURCE}) – položka smazána`,
  } });
  pv.deletedModels.push({ name: c.name, category: c.category, n, codes: c.sourceCodes, units: units.length });
  if (usedByJobs.get(c.id)) problems.push(`Mazaná položka „${c.name}“ je na zakázce (${usedByJobs.get(c.id)}× v jobItems).`);
}

const auditId = `cs-import-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const after = sum([...byModel.values()], (l) => l.length);
ops.push({ op: 'set', col: 'auditLogs', id: auditId, data: {
  id: auditId, timestamp: now, user: ACTOR, jobId: '', type: 'add', action: 'Srovnání skladu s Comsysem',
  detail: `${SOURCE}: +${pv.added.length} kusů se štítkem, ${pv.newModels.length} nové položky, smazáno ${pv.deletedModels.length} položek (${sum(pv.deletedModels, (m) => m.n)} ks)`,
} });

fs.writeFileSync(planFile, JSON.stringify({ source: SOURCE, createdAt: now, ops }, null, 1));

// ── preview ──────────────────────────────────────────────────────────
const md = [];
const table = (head, lines) => { md.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map((l) => `| ${l.map((v) => String(v ?? '').replace(/\|/g, '/')).join(' | ')} |`), ''); };
const fieldText = (f) => [f.condition && `stav ${f.condition}`, f.led !== undefined && `LED ${f.led ? 'ano' : 'ne'}`, f.serialNumber && `v. č. ${f.serialNumber}`, f.note].filter(Boolean).join(', ');
const LABEL = { condition: 'stav', led: 'LED', serialNumber: 'v. č.', note: 'poznámka' };
const val = (v) => (v === undefined || v === '' ? '–' : v === true ? 'ano' : v === false ? 'ne' : v);
const before = sum(live.stockLevels, total);

md.push('# Náhled: srovnání skladu s Comsysem', '',
  `Zdroj: ${SOURCE} (${rows.length} řádků). Stav aplikace přečten ${now.slice(0, 16).replace('T', ' ')} UTC. **Do databáze se zatím nic nezapsalo.**`, '',
  '## Souhrn', '');
table(['', 'Před', 'Po'], [
  ['Položek v katalogu', live.catalog.length, byModel.size],
  ['Kusů celkem', before, after],
  ['Kusů se štítkem', live.stockUnits.length, live.stockUnits.length + pv.added.length - pv.deletedUnits.length - sum(pv.deletedModels, (m) => m.units)],
]);
md.push(`Všechny kusy budou vedené jako **ve skladu**. Zápisů do databáze: ${ops.length}.`, '');
if (problems.length) md.push('## Nevyřešeno', '', ...problems.map((p) => `- ${p}`), '');

md.push(`## Nové položky katalogu (${pv.newModels.length})`, '');
table(['Položka', 'Kusů', 'Ev. čísla'], pv.newModels.map((m) => [m.name, m.n, m.codes]));

const addedBy = [...count(pv.added, (a) => a.name)].sort((a, b) => b[1] - a[1]);
md.push(`## Nové kusy se štítkem (${pv.added.length})`, '');
table(['Položka', 'Přibude', 'Ev. čísla', 'Vytěženo z poznámek'], addedBy.map(([name, n]) => {
  const list = pv.added.filter((a) => a.name === name);
  return [name, n, list.map((a) => a.ev).join(', '), list.filter((a) => fieldText(a.fields)).map((a) => `${a.ev}: ${fieldText(a.fields)}`).join('; ')];
}));

md.push(`## Změny počtů (${pv.counts.length})`, '');
table(['Položka', 'Bylo', 'Bude', 'Rozdíl'], pv.counts.map((c) => [c.name, c.before, c.target, (c.target > c.before ? '+' : '') + (c.target - c.before)]));

md.push(`## Kusy přeřazené k jiné položce (${pv.moved.length})`, '', 'Comsys je vede pod jiným druhem než aplikace.', '');
table(['Ev. číslo', 'Z', 'Do'], pv.moved.map((m) => [m.ev, m.from, m.to]));

md.push(`## Smazané položky katalogu (${pv.deletedModels.length} položek, ${sum(pv.deletedModels, (m) => m.n)} ks)`, '', 'V exportu nejsou.', '');
table(['Položka', 'Kategorie', 'Kusů', 'Inv. čísla'], pv.deletedModels.sort((a, b) => a.name.localeCompare(b.name, 'cs')).map((m) => [m.name, m.category, m.n, [...new Set(String(m.codes).split(', '))].join(', ')]));

md.push(`## Smazané jednotlivé kusy (${pv.deletedUnits.length})`, '');
table(['Kus', 'Položka', 'Údaje v aplikaci'], pv.deletedUnits.map((u) => [u.code, u.name, u.note]));

// LED yes/no is new for every piece, so it is summed up; the table lists the other changes.
const ledNew = pv.unitChanges.filter((u) => u.change.led);
const other = pv.unitChanges.map((u) => ({ ...u, change: Object.fromEntries(Object.entries(u.change).filter(([k]) => k !== 'led')) }))
  .filter((u) => Object.keys(u.change).length);
md.push('## Údaje vytěžené z poznámek u existujících kusů', '',
  `- **LED ano/ne** se nově uloží ke každému kusu: ${ledNew.length} kusů (${ledNew.filter((u) => u.change.led[1]).length}× ano, ${ledNew.filter((u) => !u.change.led[1]).length}× ne). Dosud byl údaj jen u položky jako celku.`,
  `- **Stav, výrobní číslo a poznámka** se liší od aplikace u ${other.length} kusů (tabulka). Kde aplikace údaj má a Comsys ne, zůstává.`, '');
table(['Ev. číslo', 'Položka', 'Změna'], other.map((u) => [u.ev, u.name,
  Object.entries(u.change).map(([k, [a, b]]) => `${LABEL[k]}: ${val(a)} → ${val(b)}`).join('; ')]));

md.push(`## Poznámky u položek vedených počtem (${pv.quantityNotes.length})`, '', 'Tyto položky nemají v aplikaci jednotlivé kusy, takže poznámku není kam uložit.', '');
table(['Ev. číslo', 'Položka', 'Poznámka v Comsysu'], pv.quantityNotes.map((q) => [q.ev, q.name, q.note]));

md.push(`## K pozornosti (${pv.attention.length})`, '', 'Podle poznámky nejsou v pořádku; náhled je přesto vede jako ve skladu.', '');
table(['Ev. číslo', 'Položka', 'Poznámka'], pv.attention.map((a) => [a.ev, a.name, a.note]));

fs.writeFileSync(previewFile, md.join('\n'));
console.log(JSON.stringify({
  rows: rows.length, catalog: [live.catalog.length, byModel.size], pieces: [before, after], ops: ops.length,
  newModels: pv.newModels.length, addedUnits: pv.added.length, counts: pv.counts.length, moved: pv.moved.length,
  deletedModels: pv.deletedModels.length, deletedUnits: pv.deletedUnits.length, unitChanges: pv.unitChanges.length,
  quantityNotes: pv.quantityNotes.length, problems,
}, null, 1));
