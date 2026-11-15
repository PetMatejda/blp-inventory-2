// In-memory twin of api/_lib/dataSource.js for tests (on top of tests/memoryRepo.js).
import { createMemoryRepo } from './memoryRepo.js';

export function createMemoryDataSource(seed = {}) {
  const mem = createMemoryRepo(seed);
  const repo = { ...mem.repo, flush: async () => {} };
  const col = (name) => mem.all(name);
  return {
    mem,
    repo,
    listJobs: async () => col('jobs'),
    getJob: async (id) => col('jobs').find((j) => j.id === id) || null,
    getJobItems: async (jobId) => col('jobItems').filter((i) => i.jobId === jobId),
    getJobItemsForJobs: async (ids) => col('jobItems').filter((i) => ids.includes(i.jobId)),
    getCatalog: async () => col('catalog'),
    getStockLevels: async (ids) => col('stockLevels').filter((l) => ids.includes(l.id)),
    getAuditForJob: async (jobId, max = 20) => col('auditLogs').filter((a) => a.jobId === jobId)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, max),
    getUserProfile: async (uid) => col('users').find((u) => u.id === uid) || null,
    getToken: async (hash) => col('mcpTokens').find((t) => t.id === hash) || null,
    createToken: async (hash, data) => { await mem.repo.set('mcpTokens', hash, data); },
    updateToken: async (hash, data) => { await mem.repo.update('mcpTokens', hash, data); },
    listTokens: async (uid) => col('mcpTokens').filter((t) => t.uid === uid),
  };
}
