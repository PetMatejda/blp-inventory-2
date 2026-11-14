/**
 * Tombstones — records of deleted job items, shared by the local cache
 * (storageService) and the cloud merge (firebaseDb).
 *
 * Two kinds of entries live in the same list:
 *  - ID tombstones (`ji-cat-123`): permanent. Item IDs are never reused, so an
 *    item with that ID must never come back.
 *  - Match tombstones (`<jobId>_cat_<catalogId>`, `<jobId>_name_<name>`, …):
 *    catch duplicate records of the same equipment that carry a different ID.
 *    They are stored as `<key>@<ISO time of deletion>` and only hide records
 *    last changed BEFORE the deletion. Equipment added to the job again later
 *    therefore stays visible on every device.
 *    Legacy entries without a time hide only records older than LEGACY_CUTOFF.
 */

export const LEGACY_CUTOFF = '2026-11-14T00:00:00.000Z';
const LEGACY_CUTOFF_MS = new Date(LEGACY_CUTOFF).getTime();

const timeOf = (iso) => {
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

/** Builds the match keys (without timestamps) that identify a job item. */
export function matchKeysFor({ jobId, catalogId, name }) {
  if (!jobId) return [];
  const keys = [];
  if (catalogId) keys.push(`${jobId}_cat_${catalogId}`);
  if (name) {
    const raw = String(name).trim();
    const lower = raw.toLowerCase();
    keys.push(`${jobId}_name_${lower}`, `${jobId}_${lower}`);
    if (raw !== lower) keys.push(`${jobId}_${raw}`, `${jobId}_name_${raw}`);
  }
  return keys;
}

/** Turns match keys into timestamped tombstone entries. */
export const stampKeys = (keys, deletedAt = new Date().toISOString()) =>
  keys.filter(Boolean).map((k) => `${k}@${deletedAt}`);

/**
 * Indexes a raw tombstone list for fast lookups.
 * Returns { ids: Set<string>, matches: Map<key, latestDeletionMs> }.
 */
export function indexTombstones(entries = []) {
  const ids = new Set();
  const matches = new Map();
  for (const raw of entries) {
    if (raw == null) continue;
    const entry = String(raw);
    const at = entry.lastIndexOf('@');
    const stamped = at > 0 && !Number.isNaN(Date.parse(entry.slice(at + 1)));
    if (stamped) {
      const key = entry.slice(0, at);
      const ms = new Date(entry.slice(at + 1)).getTime();
      if (!matches.has(key) || matches.get(key) < ms) matches.set(key, ms);
    } else {
      // Legacy entry: could be an item ID or an un-stamped match key.
      ids.add(entry);
      if (!matches.has(entry)) matches.set(entry, LEGACY_CUTOFF_MS);
    }
  }
  return { ids, matches };
}

/** True when the item is deleted (directly or as part of a deleted job). */
export function isItemTombstoned(item, index, deletedJobIds = new Set()) {
  if (!item) return true;
  if (item.jobId && deletedJobIds.has(item.jobId)) return true;
  if (item.id != null && index.ids.has(String(item.id))) return true;
  const itemMs = timeOf(item.updatedAt);
  return matchKeysFor(item).some((key) => {
    const deletedMs = index.matches.get(key);
    return deletedMs !== undefined && itemMs < deletedMs;
  });
}
