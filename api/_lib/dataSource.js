// Data access for the MCP server and token endpoints. One interface, two
// implementations: Firestore (production) and in-memory (tests, see
// tests/memoryDataSource.js). Reads only what a tool needs – the free Spark plan
// allows 50 000 document reads per day.
import { createAdminRepo } from './adminRepo.js';

const CATALOG_TTL_MS = 60_000;
const docs = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));

/** @param db firebase-admin Firestore */
export function createFirestoreDataSource(db) {
  let catalogCache = null;
  const repo = createAdminRepo(db);

  return {
    repo,
    async listJobs() { return docs(await db.collection('jobs').get()); },
    async getJob(id) {
      const snap = await db.collection('jobs').doc(id).get();
      return snap.exists ? { ...snap.data(), id: snap.id } : null;
    },
    async getJobItems(jobId) { return docs(await db.collection('jobItems').where('jobId', '==', jobId).get()); },
    async getJobItemsForJobs(jobIds) {
      const out = [];
      for (let i = 0; i < jobIds.length; i += 30) {
        const chunk = jobIds.slice(i, i + 30);
        out.push(...docs(await db.collection('jobItems').where('jobId', 'in', chunk).get()));
      }
      return out;
    },
    async getCatalog() {
      if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.items;
      const items = docs(await db.collection('catalog').get());
      catalogCache = { at: Date.now(), items };
      return items;
    },
    invalidateCatalog() { catalogCache = null; },
    async getStockLevels(catalogIds) {
      if (!catalogIds.length) return [];
      const snaps = await db.getAll(...catalogIds.map((id) => db.collection('stockLevels').doc(id)));
      return snaps.filter((s) => s.exists).map((s) => ({ ...s.data(), id: s.id }));
    },
    async getAuditForJob(jobId, max = 20) {
      // No composite index needed: filter by job, sort in memory.
      const items = docs(await db.collection('auditLogs').where('jobId', '==', jobId).limit(500).get());
      return items.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, max);
    },
    async getUserProfile(uid) {
      const snap = await db.collection('users').doc(uid).get();
      return snap.exists ? snap.data() : null;
    },
    // ── Personal MCP tokens (collection mcpTokens, doc id = SHA-256 of the token) ──
    async getToken(hash) {
      const snap = await db.collection('mcpTokens').doc(hash).get();
      return snap.exists ? { ...snap.data(), id: snap.id } : null;
    },
    async createToken(hash, data) { await db.collection('mcpTokens').doc(hash).set(data); },
    async updateToken(hash, data) { await db.collection('mcpTokens').doc(hash).update(data); },
    async listTokens(uid) { return docs(await db.collection('mcpTokens').where('uid', '==', uid).get()); },
  };
}
