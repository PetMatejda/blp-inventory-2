// Comsys had no fields for condition, LED or the maker's number, so people typed
// them into the free-text note. This turns such a note into fields.

const KEY = /^\s*(stav|led|pozn|v\.?\s*č|nová)/i;

/** Joins lines that the report wrapped at the column width. */
function unwrap(raw) {
  const out = [];
  for (const line of String(raw || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    const prev = out[out.length - 1];
    const prevIsText = prev && !/^\s*(stav|led|v\.?\s*č)/i.test(prev);
    if (prevIsText && prev.length >= 18 && !KEY.test(line) && !/^[+\d]/.test(line)) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

/** "50 / 2016", "4/26", "7 .2023" → "50/2016"; anything else (e.g. "S / 2015") → ''. */
function makerNumber(text) {
  const m = String(text).match(/(\d+)\s*[/.]\s*(\d{4}|\d{2})\b/);
  if (!m) return '';
  const year = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${m[1]}/${year}`;
}

/**
 * @returns {{condition?: string, led?: boolean, serialNumber?: string, serialUnclear?: string, note?: string}}
 * serialUnclear: a maker's number that could not be read reliably.
 */
export function parseNote(raw) {
  const res = {};
  const notes = [];
  const add = (t) => {
    let s = String(t || '').replace(/^[\s,;:.´-]+|[\s,;]+$/g, '').replace(/\s+,/g, ',').trim();
    if (/^nová$/i.test(s)) s = 'nová';
    if (s && !notes.some((n) => n.toLowerCase() === s.toLowerCase())) notes.push(s);
  };

  for (const line of unwrap(raw)) {
    let m;
    if ((m = line.match(/^stav\s*[:;]?\s*([A-D])\b(.*)$/i))) {
      res.condition = m[1].toUpperCase(); add(m[2]);
    } else if ((m = line.match(/^nová\s*[;´\s]*([A-D])?\s*$/i))) {
      if (m[1]) res.condition = m[1].toUpperCase();
      add('nová');
    } else if ((m = line.match(/^led\s*[:,]\s*(yes|no)\b(.*)$/i))) {
      res.led = m[1].toLowerCase() === 'yes';
      if (!/^\s*-\s*[A-D]\s*$/.test(m[2])) add(m[2]);
    } else if ((m = line.match(/^v\.?\s*č\.?\s*[:;.]?(.*)$/i))) {
      const sn = makerNumber(m[1]);
      if (sn) res.serialNumber = sn;
      else if (m[1].trim()) res.serialUnclear = m[1].replace(/\s+/g, ' ').trim();
    } else if ((m = line.match(/^pozn\s*[:;]\s*(.*)$/i))) {
      add(m[1]);
    } else {
      if (res.led === undefined && /(^|[\s,])LED($|[\s,])/.test(line)) res.led = true;
      add(line.replace(/^\((.*)\)$/, '$1'));
    }
  }
  if (notes.length) res.note = notes.join(', ');
  return res;
}
