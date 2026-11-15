// BLP Inventory MCP server (docs/MCP_SERVER_PLAN.md).
// Read tools for every token; write tools only for tokens with scope 'write'.
// Writes go through the app's own actions (src/services/inventoryActions.js) and
// always in two steps: a preview first, the change only with confirm: true.
import { createHash } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createInventoryActions } from '../../src/services/inventoryActions.js';
import { planJobItems, describePlan } from '../../src/domain/jobPlan.js';
import { availability, competingJobs } from '../../src/domain/availability.js';

export const SERVER_INFO = { name: 'blp-inventory', version: '0.2.0' };

const INSTRUCTIONS = `BLP Inventory – evidence filmového osvětlovacího a gripového vybavení (Balloon Light Praha).
Data jsou česky. Zakázka (job) má položky (jobItems) s plánovaným počtem (quantityRequested) a naloženým počtem (quantityLoaded).
Fáze zakázky: LOADING (příprava a nakládka), DERIGGING, RESTOCK; status ACTIVE / ARCHIVED.
Postup pro přípravu zakázky: najdi zakázku (list_jobs / get_job), dohledej vybavení v katalogu (search_catalog),
zavolej plan_job_items BEZ confirm (náhled), ukaž uživateli změny a nedostatky skladu, a teprve po jeho souhlasu
zavolej plan_job_items znovu se stejnými řádky, confirm: true a previewId z náhledu.
Zápisové nástroje nikdy nevolej s confirm: true bez výslovného souhlasu uživatele.`;

const norm = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const text = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'datum ve tvaru YYYY-MM-DD');

const jobView = (j) => ({
  id: j.id, name: j.name, client: j.client || '', assignedGaffer: j.assignedGaffer || '', blpResponsible: j.blpResponsible || '',
  riggingDate: j.riggingDate || '', deriggingDate: j.deriggingDate || '', status: j.status, mode: j.mode || 'LOADING',
});
const itemView = (i) => ({
  id: i.id, catalogId: i.catalogId || null, name: i.name, category: i.category, planned: i.quantityRequested || 0,
  loaded: i.quantityLoaded || 0, status: i.status, ...(i.isAdHoc ? { adHoc: true } : {}),
  ...(i.status === 'DAMAGED' ? { damage: { severity: i.damageSeverity || null, notes: i.damageNotes || '' } } : {}),
});

/** Catalog search: every word of the query scored against name, aliases, category, codes. */
export function searchCatalogItems(catalog, query, { category, limit = 20 } = {}) {
  const words = norm(query).split(/[\s,;/]+/).filter(Boolean);
  const cat = norm(category);
  const scored = [];
  for (const c of catalog) {
    if (cat && norm(c.category) !== cat) continue;
    const name = norm(c.name);
    const aliases = (c.aliases || []).map(norm);
    const codes = [c.barcode, c.serialPrefix, c.id].map(norm);
    let score = 0;
    let matched = 0;
    for (const w of words) {
      let s = 0;
      if (codes.includes(w)) s = Math.max(s, 6);
      if (aliases.some((a) => a === w)) s = Math.max(s, 5);
      if (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) s = Math.max(s, 4);
      else if (name.includes(w)) s = Math.max(s, 2);
      if (aliases.some((a) => a.includes(w))) s = Math.max(s, 3);
      if (norm(c.category).includes(w)) s = Math.max(s, 1);
      if (s) matched += 1;
      score += s;
    }
    if (!words.length) score = 1;
    if (score > 0) scored.push({ item: c, score: score + (words.length && matched === words.length ? 5 : 0), allWords: matched === words.length });
  }
  return scored.sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name), 'cs')).slice(0, limit);
}

const catalogView = (c, level) => ({
  id: c.id, name: c.name, category: c.category, ...(c.aliases?.length ? { aliases: c.aliases } : {}),
  ...(c.isBundle ? { isBundle: true, bundleItems: (c.bundleItems || []).map((s) => ({ name: s.name, qty: s.qty || 1 })) } : {}),
  ...(level ? { stock: { inStock: level.inStock || 0, onJob: level.onJob || 0, inService: level.inService || 0, missing: level.missing || 0 } } : {}),
});

/**
 * @param identity { uid, email, name, scope, label }
 * @param ds data source (api/_lib/dataSource.js or tests/memoryDataSource.js)
 */
export function createBlpMcpServer({ identity, ds, now = () => new Date() }) {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  const canWrite = identity?.scope === 'write';
  const actor = `${identity?.name || 'Neznámý'} (MCP)`;

  async function findJob({ jobId, name }) {
    if (jobId) {
      const job = await ds.getJob(jobId);
      return job ? { job } : { error: `Zakázka ${jobId} neexistuje.` };
    }
    if (!name) return { error: 'Zadej jobId nebo name.' };
    const jobs = await ds.listJobs();
    const q = norm(name);
    const exact = jobs.filter((j) => norm(j.name) === q);
    const hits = exact.length ? exact : jobs.filter((j) => norm(j.name).includes(q));
    if (hits.length === 1) return { job: hits[0] };
    if (!hits.length) return { error: `Žádná zakázka neodpovídá „${name}“.` };
    return { error: `Víc zakázek odpovídá „${name}“, upřesni jobId: ${hits.slice(0, 10).map((j) => `${j.id} (${j.name}, ${j.riggingDate || '?'})`).join('; ')}` };
  }

  /** Availability per catalog item for a job (or a date range) after the given plan. */
  async function stockCheck({ job, catalogIds, plannedHere = {} }) {
    if (!catalogIds.length) return [];
    const jobs = await ds.listJobs();
    const others = competingJobs(job, jobs);
    const otherItems = await ds.getJobItemsForJobs(others.map((j) => j.id));
    const levels = await ds.getStockLevels(catalogIds);
    return catalogIds.map((catalogId) => {
      const here = { id: job.id, jobId: job.id, catalogId, quantityRequested: plannedHere[catalogId] || 0 };
      const a = availability(catalogId, job, { jobs, jobItems: [...otherItems, here], levels });
      return { catalogId, ...(a ? { owned: a.owned, reservedElsewhere: a.reservedElsewhere, plannedHere: a.requestedHere, free: a.free, short: a.short } : { stockTracked: false }) };
    });
  }

  const actionsFor = (state) => createInventoryActions({ repo: ds.repo, getState: () => state, getActor: () => actor });
  const writeGuard = (job) => {
    if (job.status === 'ARCHIVED') return `Zakázka ${job.name} je v archivu.`;
    return null;
  };

  // ── Read ────────────────────────────────────────────────────
  server.registerTool('ping', {
    title: 'Ping',
    description: 'Checks the connection to the BLP Inventory MCP server. Returns "pong", the server time, version and who is connected.',
    inputSchema: { message: z.string().max(200).optional().describe('Optional text echoed back') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ message }) => text([
    'pong',
    `server: ${SERVER_INFO.name} ${SERVER_INFO.version}`,
    `time: ${now().toISOString()}`,
    `user: ${identity?.name || '?'} (${canWrite ? 'čtení i zápis' : 'jen čtení'})`,
    message ? `echo: ${message}` : null,
  ].filter(Boolean).join('\n')));

  server.registerTool('list_jobs', {
    title: 'Seznam zakázek',
    description: 'Lists jobs (zakázky). Default: active jobs, newest rigging date first. Filter by text (name, client, gaffer) and date range (overlapping).',
    inputSchema: {
      status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
      query: z.string().max(100).optional().describe('Text in name, client, gaffer or BLP responsible'),
      from: DATE.optional().describe('Only jobs ending on/after this date'),
      to: DATE.optional().describe('Only jobs starting on/before this date'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ status, query, from, to, limit }) => {
    const q = norm(query);
    const jobs = (await ds.listJobs())
      .filter((j) => status === 'ALL' || j.status === status)
      .filter((j) => !q || [j.name, j.client, j.assignedGaffer, j.blpResponsible].some((v) => norm(v).includes(q)))
      .filter((j) => !from || String(j.deriggingDate || j.riggingDate || '') >= from)
      .filter((j) => !to || String(j.riggingDate || '') <= to)
      .sort((a, b) => String(b.riggingDate || '').localeCompare(String(a.riggingDate || '')));
    return text({ count: jobs.length, jobs: jobs.slice(0, limit).map(jobView) });
  });

  server.registerTool('get_job', {
    title: 'Detail zakázky',
    description: 'One job with all its items (planned / loaded pieces, status, damage) and a summary. Find it by jobId or by name.',
    inputSchema: { jobId: z.string().optional(), name: z.string().max(100).optional().describe('Job name (or part of it) when jobId is unknown') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (args) => {
    const { job, error } = await findJob(args);
    if (error) return fail(error);
    const items = await ds.getJobItems(job.id);
    const byStatus = {};
    for (const i of items) byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    return text({
      job: jobView(job),
      summary: {
        items: items.length,
        plannedPieces: items.reduce((s, i) => s + (i.quantityRequested || 0), 0),
        loadedPieces: items.reduce((s, i) => s + (i.quantityLoaded || 0), 0),
        byStatus,
      },
      items: items.sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name), 'cs')).map(itemView),
    });
  });

  server.registerTool('search_catalog', {
    title: 'Hledat v katalogu',
    description: 'Searches the equipment catalog (name, slang aliases, category, barcode). Returns catalog ids for plan_job_items, set (bundle) contents and warehouse stock.',
    inputSchema: {
      query: z.string().max(100).describe('Words to search, e.g. "skypanel s60" or "kabel 32A"'),
      category: z.string().max(40).optional(),
      limit: z.number().int().min(1).max(50).default(15),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ query, category, limit }) => {
    const hits = searchCatalogItems(await ds.getCatalog(), query, { category, limit });
    const levels = await ds.getStockLevels(hits.map((h) => h.item.id));
    return text({ count: hits.length, items: hits.map((h) => catalogView(h.item, levels.find((l) => l.id === h.item.id))) });
  });

  server.registerTool('check_availability', {
    title: 'Dostupnost ve skladu',
    description: 'How many pieces are free for a job (its dates) or for a date range: owned − reserved by other active jobs in those dates − planned here. Without stock records an item reports stockTracked: false.',
    inputSchema: {
      items: z.array(z.object({ catalogId: z.string(), quantity: z.number().int().min(0).optional().describe('Pieces wanted (date-range check)') })).min(1).max(100),
      jobId: z.string().optional().describe('Use this job and its dates; its own plan counts as planned here'),
      from: DATE.optional(), to: DATE.optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ items, jobId, from, to }) => {
    let job;
    let plannedHere = {};
    if (jobId) {
      job = await ds.getJob(jobId);
      if (!job) return fail(`Zakázka ${jobId} neexistuje.`);
      for (const i of await ds.getJobItems(jobId)) if (i.catalogId) plannedHere[i.catalogId] = (plannedHere[i.catalogId] || 0) + (i.quantityRequested || 0);
    } else {
      if (!from) return fail('Zadej jobId, nebo from (a případně to).');
      job = { id: '__range__', riggingDate: from, deriggingDate: to || from, status: 'ACTIVE' };
      plannedHere = Object.fromEntries(items.map((i) => [i.catalogId, i.quantity || 0]));
    }
    const ids = [...new Set(items.map((i) => i.catalogId))];
    const catalog = await ds.getCatalog();
    const rows = await stockCheck({ job, catalogIds: ids, plannedHere });
    return text({
      period: { from: job.riggingDate || null, to: job.deriggingDate || null, ...(jobId ? { jobId, jobName: job.name } : {}) },
      items: rows.map((r) => ({ name: catalog.find((c) => c.id === r.catalogId)?.name || '?', ...r })),
    });
  });

  server.registerTool('get_job_history', {
    title: 'Historie zakázky',
    description: 'Latest audit log entries of a job (who changed what and when).',
    inputSchema: { jobId: z.string(), limit: z.number().int().min(1).max(100).default(20) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ jobId, limit }) => {
    const rows = await ds.getAuditForJob(jobId, limit);
    return text(rows.map((r) => ({ timestamp: r.timestamp, user: r.user, action: r.action, detail: r.detail })));
  });

  if (!canWrite) return server;

  // ── Write (preview → confirm) ──────────────────────────────
  server.registerTool('create_job', {
    title: 'Založit zakázku',
    description: 'Creates a new job in phase LOADING. Without confirm it only returns a preview; call again with confirm: true after the user agrees.',
    inputSchema: {
      name: z.string().min(1).max(120), client: z.string().max(120).optional(),
      assignedGaffer: z.string().max(80).optional(), blpResponsible: z.string().max(80).optional(),
      riggingDate: DATE, deriggingDate: DATE.optional(),
      confirm: z.boolean().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ confirm, ...data }) => {
    const job = { ...data, deriggingDate: data.deriggingDate || data.riggingDate };
    if (job.deriggingDate < job.riggingDate) return fail('deriggingDate je před riggingDate.');
    const same = (await ds.listJobs()).filter((j) => norm(j.name) === norm(job.name) && j.status === 'ACTIVE');
    const warning = same.length ? `Pozor: aktivní zakázka se stejným názvem už existuje (${same.map((j) => j.id).join(', ')}).` : undefined;
    if (!confirm) return text({ preview: true, job, warning, next: 'Po souhlasu uživatele zavolej znovu s confirm: true.' });
    const created = actionsFor({ jobs: [], jobItems: [], catalog: [], consumables: [] }).createJob(job);
    await ds.repo.flush();
    return text({ created: jobView(created), warning });
  });

  server.registerTool('duplicate_job', {
    title: 'Zakázka podle vzoru',
    description: 'New job as a copy of an existing one (same equipment, nothing loaded). Preview without confirm, create with confirm: true.',
    inputSchema: {
      sourceJobId: z.string(), name: z.string().min(1).max(120), client: z.string().max(120).optional(),
      riggingDate: DATE, deriggingDate: DATE.optional(), confirm: z.boolean().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ sourceJobId, confirm, ...data }) => {
    const source = await ds.getJob(sourceJobId);
    if (!source) return fail(`Zakázka ${sourceJobId} neexistuje.`);
    const items = await ds.getJobItems(sourceJobId);
    const newJob = { ...data, deriggingDate: data.deriggingDate || data.riggingDate };
    if (!confirm) {
      return text({ preview: true, source: jobView(source), newJob, items: items.length, plannedPieces: items.reduce((s, i) => s + (i.quantityRequested || 0), 0), next: 'Po souhlasu uživatele zavolej znovu s confirm: true.' });
    }
    const created = actionsFor({ jobs: [source], jobItems: items, catalog: [], consumables: [] }).duplicateJobAsTemplate(sourceJobId, newJob);
    await ds.repo.flush();
    return text({ created: jobView(created), items: items.length });
  });

  const lineSchema = z.object({
    op: z.enum(['ADD', 'SET', 'REMOVE']).default('ADD').describe('ADD = plan + quantity, SET = plan = quantity (0 removes), REMOVE = delete item'),
    catalogId: z.string().optional().describe('Catalog id from search_catalog (preferred)'),
    query: z.string().max(100).optional().describe('Catalog search text when catalogId is unknown – used only when it matches one item clearly'),
    jobItemId: z.string().optional().describe('Existing job item (e.g. ad-hoc items) for SET / REMOVE'),
    quantity: z.number().int().min(0).max(999).optional(),
  });

  server.registerTool('plan_job_items', {
    title: 'Naplánovat položky zakázky',
    description: 'Adds / changes / removes equipment on a job in phase LOADING, all at once. Step 1: call without confirm → preview (changes, stock shortages, unresolved lines, previewId). Step 2: after the user agrees, call again with the SAME lines, confirm: true and the previewId. Removing works only for items with nothing loaded.',
    inputSchema: {
      jobId: z.string(),
      lines: z.array(lineSchema).min(1).max(200),
      confirm: z.boolean().default(false),
      previewId: z.string().optional().describe('From the preview; required with confirm: true'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async ({ jobId, lines, confirm, previewId }) => {
    const job = await ds.getJob(jobId);
    if (!job) return fail(`Zakázka ${jobId} neexistuje.`);
    const guard = writeGuard(job);
    if (guard) return fail(guard);
    const [jobItems, catalog] = await Promise.all([ds.getJobItems(jobId), ds.getCatalog()]);

    // Resolve free-text lines to catalog ids (only clear matches).
    const unresolved = [];
    const resolved = [];
    lines.forEach((line, index) => {
      if (line.catalogId || line.jobItemId || !line.query) { resolved.push({ ...line, index }); return; }
      const hits = searchCatalogItems(catalog, line.query, { limit: 5 });
      const clear = hits.length === 1 || (hits.length > 1 && hits[0].allWords && hits[0].score >= hits[1].score + 3);
      if (hits.length && clear) resolved.push({ ...line, catalogId: hits[0].item.id, index, resolvedFrom: line.query });
      else unresolved.push({ line: index + 1, query: line.query, candidates: hits.map((h) => ({ catalogId: h.item.id, name: h.item.name })) });
    });

    const plan = planJobItems({ job, jobItems, catalog, lines: resolved });
    if (plan.errors.length) return fail(plan.errors.join(' '));

    const digest = createHash('sha256').update(JSON.stringify({
      jobId, lines: resolved.map(({ op, catalogId, jobItemId, quantity }) => [op, catalogId || '', jobItemId || '', quantity ?? null]),
      items: jobItems.map((i) => [i.id, i.quantityRequested || 0, i.quantityLoaded || 0, i.updatedAt || '']).sort(),
    })).digest('hex').slice(0, 16);

    if (!confirm) {
      const plannedHere = {};
      for (const i of jobItems) if (i.catalogId) plannedHere[i.catalogId] = (plannedHere[i.catalogId] || 0) + (i.quantityRequested || 0);
      for (const c of plan.changes) {
        if (!c.catalogId) continue;
        const delta = c.type === 'create' ? c.after.planned : c.type === 'delete' ? -c.before.planned : c.after.planned - c.before.planned;
        plannedHere[c.catalogId] = (plannedHere[c.catalogId] || 0) + delta;
      }
      const touched = [...new Set(plan.changes.filter((c) => c.catalogId && c.type !== 'delete').map((c) => c.catalogId))];
      const stock = (await stockCheck({ job, catalogIds: touched, plannedHere })).filter((r) => r.short > 0)
        .map((r) => ({ name: catalog.find((c) => c.id === r.catalogId)?.name, ...r }));
      return text({
        preview: true, previewId: digest, job: jobView(job),
        changes: plan.changes, summary: describePlan(plan.changes) || 'žádné změny',
        resolvedQueries: resolved.filter((r) => r.resolvedFrom).map((r) => ({ query: r.resolvedFrom, catalogId: r.catalogId, name: catalog.find((c) => c.id === r.catalogId)?.name })),
        unresolved, warnings: plan.warnings, stockShortages: stock,
        next: plan.changes.length ? 'Ukaž uživateli změny. Po jeho souhlasu zavolej znovu se stejnými lines, confirm: true a tímto previewId. Nevyřešené řádky se nezapíšou.' : 'Nic se nezmění.',
      });
    }

    if (!previewId) return fail('Chybí previewId – nejdřív zavolej plan_job_items bez confirm a ukaž uživateli náhled.');
    if (previewId !== digest) return fail('Data zakázky se od náhledu změnila (nebo jsou jiné řádky). Zavolej znovu bez confirm a ukaž uživateli nový náhled.');
    if (!plan.changes.length) return text({ applied: false, message: 'Nic se nezmění.', warnings: plan.warnings });
    const state = { jobs: [job], jobItems, catalog, consumables: [] };
    const applied = actionsFor(state).applyJobPlan(jobId, resolved, { source: 'MCP' });
    await ds.repo.flush();
    return text({ applied: true, summary: describePlan(applied.changes), changes: applied.changes, unresolvedSkipped: unresolved, warnings: applied.warnings });
  });

  server.registerTool('add_adhoc_item', {
    title: 'Přidat Ad-Hoc položku',
    description: 'Adds equipment that is not in the catalog (ad-hoc) to a job, or raises its quantity. Preview without confirm, write with confirm: true.',
    inputSchema: {
      jobId: z.string(), name: z.string().min(1).max(120), category: z.string().max(40).default('Grip'),
      quantity: z.number().int().min(1).max(999).default(1), confirm: z.boolean().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ jobId, name, category, quantity, confirm }) => {
    const job = await ds.getJob(jobId);
    if (!job) return fail(`Zakázka ${jobId} neexistuje.`);
    const guard = writeGuard(job);
    if (guard) return fail(guard);
    if (!confirm) return text({ preview: true, job: jobView(job), item: { name: `${name} (Ad-Hoc)`, category, quantity }, next: 'Po souhlasu uživatele zavolej znovu s confirm: true.' });
    const jobItems = await ds.getJobItems(jobId);
    const result = actionsFor({ jobs: [job], jobItems, catalog: [], consumables: [] }).addAdHocItem(jobId, name, category, quantity);
    await ds.repo.flush();
    return text({ applied: true, item: itemView(result) });
  });

  return server;
}
