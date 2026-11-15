// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLocalMcpServer } from '../scripts/mcp-local.mjs';
import { createMcpHandler } from '../api/mcp.js';
import { hashToken } from '../api/_lib/tokens.js';
import { createMemoryDataSource } from './memoryDataSource.js';

const WRITE = 'blp_mcp_write-token-000000000000000000000000000000000';
const READ = 'blp_mcp_read-token-0000000000000000000000000000000000';
const REVOKED = 'blp_mcp_revoked-000000000000000000000000000000000000';
const STRANGER = 'blp_mcp_stranger-00000000000000000000000000000000000';
const SPIKE = 'spike-shared-token';
const NOW = new Date('2026-11-15T10:00:00Z');

const tokenDoc = (token, extra) => ({ id: hashToken(token), uid: 'u1', email: 'petmatejda@gmail.com', name: 'Petr', label: 'test', scope: 'read', createdAt: '2026-11-01T00:00:00Z', revoked: false, ...extra });

const seed = () => ({
  catalog: [
    { id: 'cat-sky', name: 'ARRI SkyPanel S60-C', category: 'Lights', aliases: ['šedesátka'], serialPrefix: 'SKY' },
    { id: 'cat-hmi', name: 'HMI 2.5 kW', category: 'Lights', aliases: ['dvacítka'] },
    { id: 'cat-stand', name: 'Stativ C-Stand', category: 'Grip' },
    { id: 'cat-set', name: 'Set SkyPanel', category: 'Lights', isBundle: true, bundleItems: [{ name: 'ARRI SkyPanel S60-C', qty: 2 }, { name: 'Stativ C-Stand', qty: 2 }] },
  ],
  stockLevels: [{ id: 'cat-sky', inStock: 4, onJob: 0, inService: 0, missing: 0 }],
  jobs: [
    { id: 'job-a', name: 'Granilla', client: 'Bistro Films', status: 'ACTIVE', mode: 'LOADING', riggingDate: '2026-11-20', deriggingDate: '2026-11-22' },
    { id: 'job-b', name: 'Velká Amerika', status: 'ACTIVE', mode: 'LOADING', riggingDate: '2026-11-21', deriggingDate: '2026-11-21' },
    { id: 'job-old', name: 'Vodafone spot', status: 'ARCHIVED', mode: 'LOADING', riggingDate: '2026-08-10' },
    { id: 'job-d', name: 'Shadows', status: 'ACTIVE', mode: 'DERIGGING', riggingDate: '2026-11-10' },
  ],
  jobItems: [
    { id: 'it-hmi', jobId: 'job-a', catalogId: 'cat-hmi', name: 'HMI 2.5 kW', category: 'Lights', quantityRequested: 2, quantityLoaded: 1, status: 'PENDING', updatedAt: 't1' },
    { id: 'it-b-sky', jobId: 'job-b', catalogId: 'cat-sky', name: 'ARRI SkyPanel S60-C', category: 'Lights', quantityRequested: 3, quantityLoaded: 0, status: 'PENDING' },
  ],
  auditLogs: [{ id: 'a1', jobId: 'job-a', timestamp: '2026-11-14T08:00:00Z', user: 'Marek', action: 'Nová zakázka', detail: 'Granilla' }],
  mcpTokens: [
    tokenDoc(WRITE, { scope: 'write' }),
    tokenDoc(READ),
    tokenDoc(REVOKED, { revoked: true }),
    tokenDoc(STRANGER, { email: 'someone@else.cz' }),
  ],
});

let ds;
let httpServer;
let url;

beforeEach(async () => {
  ds = createMemoryDataSource(seed());
  const handler = createMcpHandler({ getDs: async () => ds, env: { MCP_SPIKE_TOKEN: SPIKE }, now: () => NOW });
  httpServer = createLocalMcpServer(handler);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${httpServer.address().port}/api/mcp`;
});
afterEach(async () => { await new Promise((resolve) => httpServer.close(resolve)); });

async function connect(token, how = 'bearer') {
  const client = new Client({ name: 'test', version: '1.0.0' });
  const headers = how === 'bearer' ? { Authorization: `Bearer ${token}` } : how === 'x-api-key' ? { 'X-API-Key': token } : {};
  const target = how === 'query' ? `${url}?key=${encodeURIComponent(token)}` : url;
  await client.connect(new StreamableHTTPClientTransport(new URL(target), { requestInit: { headers } }));
  return client;
}
const call = async (client, name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content[0].text;
  let data; try { data = JSON.parse(t); } catch { data = t; }
  return { isError: !!r.isError, data, text: t };
};

describe('MCP auth', () => {
  it('refuses missing, unknown, revoked and no-longer-approved tokens with 403', async () => {
    for (const t of ['', 'blp_mcp_nope', REVOKED, STRANGER]) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { 'X-API-Key': t } : {}) }, body: '{}' });
      expect(r.status).toBe(403);
    }
  });

  it.each(['bearer', 'x-api-key', 'query'])('accepts a personal token via %s', async (how) => {
    const client = await connect(READ, how);
    const r = await call(client, 'ping');
    expect(r.text).toMatch(/^pong/);
    expect(r.text).toContain('Petr (jen čtení)');
    await client.close();
  });

  it('records lastUsedAt of a token', async () => {
    const client = await connect(READ);
    await client.close();
    expect(ds.mem.all('mcpTokens').find((t) => t.id === hashToken(READ)).lastUsedAt).toBe(NOW.toISOString());
  });

  it('read token sees only read tools; write token also write tools', async () => {
    const reader = await connect(READ);
    expect((await reader.listTools()).tools.map((t) => t.name).sort()).toEqual(['check_availability', 'get_job', 'get_job_history', 'list_jobs', 'ping', 'search_catalog']);
    await reader.close();
    const writer = await connect(WRITE);
    const names = (await writer.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['create_job', 'duplicate_job', 'plan_job_items', 'add_adhoc_item']));
    await writer.close();
  });

  it('the shared spike token is read-only', async () => {
    const client = await connect(SPIKE, 'query');
    expect((await client.listTools()).tools.map((t) => t.name)).not.toContain('plan_job_items');
    await client.close();
  });
});

describe('MCP read tools', () => {
  let client;
  beforeEach(async () => { client = await connect(READ); });
  afterEach(async () => { await client.close(); });

  it('list_jobs filters active jobs and text', async () => {
    const { data } = await call(client, 'list_jobs', {});
    expect(data.jobs.map((j) => j.id)).toEqual(['job-b', 'job-a', 'job-d']);
    const q = await call(client, 'list_jobs', { query: 'bistro' });
    expect(q.data.jobs.map((j) => j.id)).toEqual(['job-a']);
  });

  it('get_job finds a job by name without diacritics and returns items', async () => {
    const { data } = await call(client, 'get_job', { name: 'velka amerika' });
    expect(data.job.id).toBe('job-b');
    expect(data.items[0]).toMatchObject({ catalogId: 'cat-sky', planned: 3, loaded: 0 });
    expect(data.summary.plannedPieces).toBe(3);
  });

  it('search_catalog matches names and slang aliases, with stock', async () => {
    const sky = await call(client, 'search_catalog', { query: 'skypanel s60' });
    expect(sky.data.items[0]).toMatchObject({ id: 'cat-sky', stock: { inStock: 4 } });
    const alias = await call(client, 'search_catalog', { query: 'dvacitka' });
    expect(alias.data.items[0].id).toBe('cat-hmi');
  });

  it('check_availability counts overlapping jobs', async () => {
    const { data } = await call(client, 'check_availability', { from: '2026-11-21', items: [{ catalogId: 'cat-sky', quantity: 2 }] });
    expect(data.items[0]).toMatchObject({ owned: 4, reservedElsewhere: 3, plannedHere: 2, free: -1, short: 1 });
  });

  it('get_job_history returns audit entries', async () => {
    const { data } = await call(client, 'get_job_history', { jobId: 'job-a' });
    expect(data[0]).toMatchObject({ user: 'Marek', action: 'Nová zakázka' });
  });
});

describe('MCP write tools', () => {
  let client;
  beforeEach(async () => { client = await connect(WRITE); });
  afterEach(async () => { await client.close(); });

  const lines = [
    { op: 'ADD', catalogId: 'cat-sky', quantity: 2 },
    { op: 'SET', query: 'dvacitka', quantity: 4 },
    { op: 'ADD', query: 'neexistujici vec', quantity: 1 },
  ];

  it('plan_job_items: preview writes nothing, confirm applies with one audit entry', async () => {
    const preview = await call(client, 'plan_job_items', { jobId: 'job-a', lines });
    expect(preview.data.preview).toBe(true);
    expect(preview.data.summary).toBe('HMI 2.5 kW: 2 → 4 ks, + ARRI SkyPanel S60-C (2 ks)');
    expect(preview.data.unresolved).toHaveLength(1);
    expect(preview.data.stockShortages[0]).toMatchObject({ catalogId: 'cat-sky', short: 1 });
    expect(ds.mem.all('jobItems').filter((i) => i.jobId === 'job-a')).toHaveLength(1);

    const noId = await call(client, 'plan_job_items', { jobId: 'job-a', lines, confirm: true });
    expect(noId.isError).toBe(true);

    const done = await call(client, 'plan_job_items', { jobId: 'job-a', lines, confirm: true, previewId: preview.data.previewId });
    expect(done.data.applied).toBe(true);
    const items = ds.mem.all('jobItems').filter((i) => i.jobId === 'job-a');
    expect(items.find((i) => i.catalogId === 'cat-hmi')).toMatchObject({ quantityRequested: 4, quantityLoaded: 1, updatedBy: 'Petr (MCP)' });
    expect(items.find((i) => i.catalogId === 'cat-sky')).toMatchObject({ quantityRequested: 2, quantityLoaded: 0, status: 'PENDING' });
    const audit = ds.mem.all('auditLogs').filter((a) => a.action === 'Plán položek (MCP)');
    expect(audit).toHaveLength(1);
    expect(audit[0].user).toBe('Petr (MCP)');
  });

  it('plan_job_items refuses a stale preview', async () => {
    const preview = await call(client, 'plan_job_items', { jobId: 'job-a', lines });
    await ds.repo.update('jobItems', 'it-hmi', { quantityLoaded: 2, updatedAt: 't2' });
    const r = await call(client, 'plan_job_items', { jobId: 'job-a', lines, confirm: true, previewId: preview.data.previewId });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/změnila/);
  });

  it('plan_job_items refuses archived jobs and jobs past loading', async () => {
    expect((await call(client, 'plan_job_items', { jobId: 'job-old', lines })).isError).toBe(true);
    expect((await call(client, 'plan_job_items', { jobId: 'job-d', lines })).isError).toBe(true);
  });

  it('create_job previews, then creates on confirm', async () => {
    const args = { name: 'Nový spot', client: 'Klient', riggingDate: '2026-12-01' };
    const p = await call(client, 'create_job', args);
    expect(p.data.preview).toBe(true);
    expect(ds.mem.all('jobs')).toHaveLength(4);
    const c = await call(client, 'create_job', { ...args, confirm: true });
    expect(c.data.created).toMatchObject({ name: 'Nový spot', status: 'ACTIVE', mode: 'LOADING', deriggingDate: '2026-12-01' });
    expect(ds.mem.all('jobs')).toHaveLength(5);
  });

  it('duplicate_job copies the items', async () => {
    const c = await call(client, 'duplicate_job', { sourceJobId: 'job-a', name: 'Granilla 2', riggingDate: '2026-12-05', confirm: true });
    const newId = c.data.created.id;
    expect(ds.mem.all('jobItems').filter((i) => i.jobId === newId)).toHaveLength(1);
  });

  it('add_adhoc_item adds after confirm', async () => {
    await call(client, 'add_adhoc_item', { jobId: 'job-a', name: 'Žebřík', quantity: 2 });
    expect(ds.mem.all('jobItems').filter((i) => i.isAdHoc)).toHaveLength(0);
    const r = await call(client, 'add_adhoc_item', { jobId: 'job-a', name: 'Žebřík', quantity: 2, confirm: true });
    expect(r.data.item).toMatchObject({ name: 'Žebřík (Ad-Hoc)', planned: 2, adHoc: true });
  });
});

describe('MCP endpoint basics', () => {
  it('non-POST is 405, unconfigured server is 503', async () => {
    const get = await fetch(url, { headers: { 'X-API-Key': READ } });
    expect(get.status).toBe(405);
    const bare = createLocalMcpServer(createMcpHandler({ getDs: async () => null, env: {} }));
    await new Promise((resolve) => bare.listen(0, '127.0.0.1', resolve));
    const r = await fetch(`http://127.0.0.1:${bare.address().port}/api/mcp`, { method: 'POST', body: '{}' });
    expect(r.status).toBe(503);
    await new Promise((resolve) => bare.close(resolve));
  });
});
