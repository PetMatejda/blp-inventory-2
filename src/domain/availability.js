// Stock availability for a job's date range — pure functions without UI imports,
// so the same rules run in the app and on the server (MCP, api/).

export const emptyLevel = { inStock: 0, onJob: 0, inService: 0, missing: 0 };
export const levelOf = (levels, catalogId) => ({ ...emptyLevel, ...(levels?.find?.((l) => l.id === catalogId) || {}) });

/** Pieces the company has and knows where they are (missing pieces excluded). */
export const ownedCount = (level) => (level.inStock || 0) + (level.onJob || 0) + (level.inService || 0);

const day = (iso) => String(iso || '').slice(0, 10);
const jobStart = (job) => day(job.riggingDate || job.date);
const jobEnd = (job) => day(job.deriggingDate || job.riggingDate || job.date);

/** Do two jobs overlap in time (dates inclusive)? Jobs without dates overlap everything. */
export function jobsOverlap(a, b) {
  const [as, ae, bs, be] = [jobStart(a), jobEnd(a), jobStart(b), jobEnd(b)];
  if (!as || !bs) return true;
  return as <= (be || bs) && bs <= (ae || as);
}

/** Active jobs (other than `job`) that compete for the same pieces in its dates. */
export const competingJobs = (job, jobs = []) => jobs
  .filter((j) => j.id !== job?.id && j.status === 'ACTIVE' && j.mode !== 'RESTOCK' && (!job || jobsOverlap(j, job)));

/**
 * How many pieces of a catalog item are free for a job in its date range.
 * Returns null while the warehouse stock has not been set up for the item.
 */
export function availability(catalogId, job, { jobs = [], jobItems = [], levels = [] }) {
  const levelDoc = levels.find((l) => l.id === catalogId);
  if (!levelDoc) return null;
  const owned = ownedCount(levelOf(levels, catalogId));
  const otherJobs = new Set(competingJobs(job, jobs).map((j) => j.id));
  const sum = (pred) => jobItems.filter((i) => i.catalogId === catalogId && pred(i)).reduce((s, i) => s + (i.quantityRequested || 0), 0);
  const reservedElsewhere = sum((i) => otherJobs.has(i.jobId));
  const requestedHere = job ? sum((i) => i.jobId === job.id) : 0;
  const free = owned - reservedElsewhere - requestedHere;
  return { owned, reservedElsewhere, requestedHere, free, short: Math.max(0, -free) };
}
