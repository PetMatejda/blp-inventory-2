// Converts the ZapSklad Excel export (JSON from read_xlsx.py) into an import plan
// for BLP Inventory: catalog models, labelled units, stock levels and INIT movements.
//
// Usage: node scripts/zapsklad/build-plan.mjs <excel.json> <plan.json> <models.csv>
//
// IDs are deterministic, so running the import again with a fresh export updates
// the same records instead of duplicating them.
import fs from 'node:fs';

const [, , inFile, planFile, csvFile] = process.argv;
const sheets = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const SOURCE = 'ZapSklad export 2024';

// ── helpers ──────────────────────────────────────────────────────────
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const slug = (s) => clean(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const kw = (s) => clean(s).replace(/(\d)\s*([kK][wW])\b/g, '$1 kW').replace(/(\d)\s*[wW]\b/g, '$1 W');

/** One name per model: fixes typos and removes per-piece numbering (#1, (2), č. 1). */
function modelName(raw) {
  let n = clean(raw)
    .replace(/\s*#\d+$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/\s+č\.\s*\d+\s*/i, ' ')
    .replace(/^Balast\b/, 'Ballast')
    .replace(/^Ballon\b/, 'Balloon')
    .replace(/pannel/i, 'panel')
    .replace(/black\s*top/i, 'blacktop')
    .replace(/(\d)m\b/g, '$1 m');
  n = kw(n);
  return clean(n);
}

/** Excel serial date → YYYY-MM-DD; anything else → ''. */
function excelDate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 30000 || n > 60000) return '';
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
}

// ── classification ───────────────────────────────────────────────────
const BALLOON_ICON = {
  gaffair: 'lampFloor', springball: 'springball', cloud: 'cloud', tube: 'cylinder',
  round: 'globe', cube: 'box', eliptic: 'egg', 'zero gravity': 'disc',
};

function classify(sheet, r) {
  const name = (r.name || '').toLowerCase();
  if (sheet === 'Balloon') {
    return { category: 'Lights', icon: BALLOON_ICON[(r.shape || '').toLowerCase()] || 'lightbulb', prefix: 'BAL' };
  }
  if (sheet === 'Electro') {
    const sort = (r.sort || '').toLowerCase();
    const type = (r.type || '').toLowerCase();
    if (sort.startsWith('led module')) {
      if (name.includes('net')) return { category: 'Lights', icon: 'grid', prefix: 'NET' };
      if (name.includes('springball')) return { category: 'Lights', icon: 'springball', prefix: 'SPB' };
      return { category: 'Lights', icon: 'panel', prefix: 'LED' };
    }
    if (sort === 'cable') {
      if (type === 'led') return { category: 'Cables', icon: 'cable', prefix: 'KAB' };
      return { category: 'Lights', icon: 'lightbulb', prefix: type === 'tungsten' ? 'TUN' : 'HMI' };
    }
    if (sort.startsWith('zdroj')) {
      if (name.includes('dimmer')) return { category: 'Ballasts', icon: 'dimmer', prefix: 'DIM' };
      return { category: 'Ballasts', icon: 'cpu', prefix: 'BLS' };
    }
    // Ostatní / Others
    if (name.includes('fukar')) return { category: 'Tools', icon: 'fan', prefix: 'FUK' };
    if (name.includes('balast') || name.includes('ballast')) return { category: 'Ballasts', icon: 'cpu', prefix: 'BLS' };
    if (name.includes('power box') || name.includes('spliter') || name.includes('splitter')) return { category: 'Distribution', icon: 'split', prefix: 'DST' };
    if (name.includes('redukční') || name.includes('drei')) return { category: 'Cables', icon: 'adapter', prefix: 'RED' };
    return { category: 'Cables', icon: 'cable', prefix: 'KAB' };
  }
  // Accessories
  const sort = (r.sort || '').toLowerCase();
  if (sort === 'filter') return { category: 'Textiles', icon: 'filter', prefix: 'FLT' };
  if (sort === 'moonlite') return { category: 'Distribution', icon: 'radio', prefix: 'MNL', tracking: 'SERIAL' };
  if (name.includes('frame')) return { category: 'Grip', icon: 'frame', prefix: 'FRM' };
  if (name.includes('eggcrate')) return { category: 'Textiles', icon: 'eggcrate', prefix: 'EGG' };
  return { category: 'Textiles', icon: 'cloth', prefix: 'TXT' };
}

// ── rows → normalized pieces ─────────────────────────────────────────
const COLS = {
  Balloon: { code: 0, serial: 1, type: 3, shape: 4, condition: 5, size: 6, led: 7, name: 8, note: 9 },
  Electro: { code: 0, sort: 2, type: 3, power: 4, usage: 5, brand: 6, name: 7, revision: 8, note: 12 },
  Accessories: { code: 0, sort: 2, type: 3, size: 4, usage: 5, brand: 6, name: 7, note: 10 },
};

const pieces = [];
const skipped = { empty: 0 };
for (const [sheet, rows] of Object.entries(sheets)) {
  const map = COLS[sheet];
  if (!map) continue;
  for (const row of rows.slice(1)) {
    const r = Object.fromEntries(Object.entries(map).map(([k, i]) => [k, clean(row[i])]));
    if (!r.name) { skipped.empty++; continue; } // reserved inventory number without data
    pieces.push({ sheet, ...r });
  }
}

// ── group into models ────────────────────────────────────────────────
const models = new Map();
for (const p of pieces) {
  const name = modelName(p.name);
  const id = `zs-${slug(p.sheet)}-${slug(name)}`;
  if (!models.has(id)) {
    const cls = classify(p.sheet, p);
    models.set(id, {
      id, name, sheet: p.sheet, ...cls, pieces: [],
      power: '', size: '', brand: '', usage: '', led: null, sourceNames: new Set(),
    });
  }
  const m = models.get(id);
  m.pieces.push(p);
  m.sourceNames.add(p.name);
  if (p.sheet === 'Balloon') {
    if (/kw/i.test(p.size)) m.power ||= kw(p.size); else m.size ||= clean(p.size).replace(/,\s*yes$/i, '');
    if (p.led) m.led = m.led || p.led.toLowerCase() === 'yes';
  } else {
    if (p.power && p.power !== '??') m.power ||= kw(p.power);
    m.size ||= p.size || '';
    m.brand ||= p.brand || '';
    m.usage ||= p.usage || '';
  }
}

// ── tracking, units, levels ──────────────────────────────────────────
const now = new Date().toISOString();
const actor = 'Import ZapSklad';
const allCodes = new Map();
for (const p of pieces) allCodes.set(p.code, (allCodes.get(p.code) || 0) + 1);

const catalog = []; const units = []; const levels = []; const movements = []; const csv = [];
const notes = [];
for (const m of [...models.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const count = m.pieces.length;
  const codesUnique = m.pieces.every((p) => p.code && allCodes.get(p.code) === 1);
  let tracking = m.tracking || (['Lights', 'Ballasts'].includes(m.category) ? 'SERIAL' : 'QUANTITY');
  // Flatlight 250W modules: hundreds of small identical panels — counted, not labelled one by one.
  if (/flatlight 250/i.test(m.name)) tracking = 'QUANTITY';
  if (tracking === 'SERIAL' && !codesUnique) {
    tracking = 'QUANTITY';
    notes.push(`${m.name}: sdílená inventární čísla → evidence počtem`);
  }

  const conditions = [...new Set(m.pieces.map((p) => p.condition).filter(Boolean))].sort();
  catalog.push({
    id: m.id, name: m.name, category: m.category, icon: m.icon,
    weight: '', power: m.power, size: m.size, brand: m.brand, usage: m.usage,
    ...(m.led !== null ? { led: m.led } : {}),
    image: '', barcode: '', serialPrefix: m.prefix, trackingType: tracking,
    availableCount: count, isBundle: false, bundleItems: [],
    source: SOURCE, sourceCodes: m.pieces.map((p) => p.code).filter(Boolean).join(', '),
    createdAt: now, updatedAt: now, updatedBy: actor,
  });
  levels.push({ id: m.id, catalogId: m.id, inStock: count, onJob: 0, inService: 0, missing: 0, updatedAt: now, updatedBy: actor });
  movements.push({
    id: `zs-init-${m.id}`, type: 'INIT', label: 'Založení stavu', catalogId: m.id, itemName: m.name,
    qty: count, timestamp: now, user: actor, note: `Import ze ZapSkladu (${SOURCE})`,
  });
  if (tracking === 'SERIAL') {
    for (const p of m.pieces) {
      const revisionDate = excelDate(p.revision);
      units.push({
        id: `zs-${slug(p.code)}`, catalogId: m.id, code: p.code, serialNumber: p.serial || p.code,
        status: 'IN_STOCK',
        ...(p.condition ? { condition: p.condition } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(revisionDate ? { revisionDate } : {}),
        createdAt: now, updatedAt: now, updatedBy: actor,
      });
    }
  }
  csv.push([m.sheet, m.name, m.category, m.icon, tracking, count, m.power, m.size, m.brand, m.usage,
    conditions.join('/'), [...m.sourceNames].length > 1 ? [...m.sourceNames].join(' | ') : '',
    m.pieces.map((p) => p.code).join(' ')]);
}

const plan = { source: SOURCE, createdAt: now, catalog, stockUnits: units, stockLevels: levels, movements };
fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const header = ['List', 'Model', 'Kategorie', 'Ikona', 'Evidence', 'Kusů', 'Výkon', 'Velikost', 'Výrobce', 'Použití', 'Stav', 'Sloučené názvy', 'Inv. čísla'];
fs.writeFileSync(csvFile, '﻿' + [header, ...csv].map((r) => r.map(esc).join(';')).join('\r\n'));

const by = (arr, k) => arr.reduce((o, x) => ({ ...o, [x[k]]: (o[x[k]] || 0) + 1 }), {});
console.log(JSON.stringify({
  pieces: pieces.length, skippedEmptyRows: skipped.empty, models: catalog.length, units: units.length,
  byCategory: by(catalog, 'category'), byIcon: by(catalog, 'icon'), byTracking: by(catalog, 'trackingType'), notes,
}, null, 1));
