// Production calendar ("Tabulka prací"): the shared plan of jobs and their phases.
//
// Stored as one document meta/productionCalendar, written by the MCP tool
// set_production_calendar (Cowork builds it from the weekly table):
//   { source, tableDate, updatedAt, updatedBy,
//     projects: [{ id, name, color, jobs: [{ id, title, location, status, gear, crew, notes,
//       phases: [{ type, label, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }] }] }] }
// It is only an overview of dates; it is not linked to the jobs with equipment.

export const PHASE_TYPES = {
  prep: { label: 'Přípravy', color: '#7c5cbf' },
  travel: { label: 'Travel', color: '#3a85e0' },
  rigging: { label: 'Rigging', color: '#e04f1a' },
  prelight: { label: 'Prelight', color: '#c99000' },
  shoot: { label: 'Natáčení', color: '#0aaa80' },
  camera: { label: 'Camera test', color: '#5090cc' },
  derigg: { label: 'Derigging', color: '#d04070' },
  vfx: { label: 'VFX scan', color: '#3aadaa' },
};
export const phaseMeta = (type) => PHASE_TYPES[type] || { label: type || 'Akce', color: '#868993' };

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (date, n) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };

/** Checks the shape before storing. Returns a Czech error message or null. */
export function validateCalendar(cal) {
  if (!cal || !Array.isArray(cal.projects)) return 'Chybí seznam projektů (projects).';
  for (const p of cal.projects) {
    if (!p?.name) return 'Projekt bez názvu.';
    if (!Array.isArray(p.jobs)) return `Projekt ${p.name}: chybí zakázky (jobs).`;
    for (const j of p.jobs) {
      if (!j?.title) return `Projekt ${p.name}: zakázka bez názvu.`;
      for (const ph of j.phases || []) {
        if (!isIso(ph.start) || !isIso(ph.end)) return `${j.title}: fáze má mít data start/end ve tvaru YYYY-MM-DD.`;
        if (ph.end < ph.start) return `${j.title}: fáze končí dřív, než začíná (${ph.start} – ${ph.end}).`;
      }
    }
  }
  return null;
}

/**
 * Day-by-day list for the phone: every day from `from` for `days` days that has
 * something on it. Jobs of the app (with equipment) are added as rigging /
 * derigging days so one list shows everything.
 * → [{ date, items: [{ key, type, label, color, title, project, location, gear, crew, notes, status, jobId? }] }]
 */
export function buildAgenda({ calendar = null, jobs = [], from, days = 14 }) {
  const to = addDays(from, days - 1);
  const byDate = new Map();
  const push = (date, item) => {
    if (date < from || date > to) return;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  };

  for (const project of calendar?.projects || []) {
    for (const job of project.jobs || []) {
      for (const [i, phase] of (job.phases || []).entries()) {
        if (!isIso(phase.start) || !isIso(phase.end) || phase.end < from || phase.start > to) continue;
        const meta = phaseMeta(phase.type);
        for (let d = phase.start < from ? from : phase.start; d <= phase.end && d <= to; d = addDays(d, 1)) {
          push(d, {
            key: `${project.id || project.name}-${job.id || job.title}-${i}-${d}`,
            type: phase.type, label: phase.label || meta.label, color: meta.color,
            title: job.title, project: project.name, location: job.location || '',
            gear: job.gear || '', crew: job.crew || '', notes: job.notes || '', status: job.status || null,
          });
        }
      }
    }
  }

  for (const job of jobs) {
    if (job.status !== 'ACTIVE') continue;
    const rig = job.riggingDate || job.date;
    const derig = job.deriggingDate;
    const base = { title: job.name, project: job.client || '', location: '', gear: '', crew: '', notes: '', status: null, jobId: job.id };
    if (isIso(rig)) push(rig, { ...base, key: `job-${job.id}-rig`, type: 'rigging', label: 'Rigging (zakázka v aplikaci)', color: PHASE_TYPES.rigging.color });
    if (isIso(derig) && derig !== rig) push(derig, { ...base, key: `job-${job.id}-derig`, type: 'derigg', label: 'Derigging (zakázka v aplikaci)', color: PHASE_TYPES.derigg.color });
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

/** What is on a given day — offered as a note when filling in attendance. */
export function titlesOn(calendar, jobs, date) {
  const day = buildAgenda({ calendar, jobs, from: date, days: 1 })[0];
  return [...new Set((day?.items || []).map((i) => i.title))];
}
