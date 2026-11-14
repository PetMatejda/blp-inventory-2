// One-time migration from the legacy single document to collections.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildMigrationPlan, migrateLegacyStore, AUDIT_LIMIT } from '../src/services/migration.js';
import { INITIAL_JOBS, INITIAL_JOB_ITEMS, INITIAL_CATALOG, INITIAL_CONSUMABLES } from '../src/mockData/initialData.js';
import { makeJob, makeItem, makeCatalogItem } from './helpers.js';

const legacy = () => ({
  jobs: [makeJob(), makeJob({ id: 'job-dead', name: 'Smazaná' })],
  jobItems: [
    makeItem({ id: 'a', quantityRequested: 2, quantityLoaded: 2, serialNumber: undefined }),
    makeItem({ id: 'b', quantityRequested: 3, quantityLoaded: 0, serialNumber: 'SKY-2' }),          // duplicate of a
    makeItem({ id: 'gone', name: 'Kabel', catalogId: null }),                                     // deleted by ID
    makeItem({ id: 'old-dup', name: 'Dedo', catalogId: null, updatedAt: '2026-10-01T00:00:00Z' }), // deleted by name
    makeItem({ id: 'orphan', jobId: 'job-dead' }),                                                // job deleted
    makeItem({ id: 'nojob', jobId: 'job-unknown' }),                                              // job missing
    makeItem({ id: undefined, name: 'Bez ID', catalogId: null }),
  ],
  catalog: [makeCatalogItem(), makeCatalogItem({ id: 'cat-dead' })],
  consumables: [{ id: 'con-1', name: 'Gaffa', state: 1 }],
  auditLogs: [
    { id: 'log-1', timestamp: '2026-11-01T10:00:00Z', action: 'a' },
    { id: 'log-1', timestamp: '2026-11-01T11:00:00Z', action: 'b' }, // same ID (old Date.now() IDs)
    { id: 'log-x' }, // no timestamp
  ],
  deletedJobItemIds: ['gone', 'job-1_name_dedo'],
  deletedJobIds: ['job-dead'],
  deletedCatalogIds: ['cat-dead'],
});

describe('plán migrace', () => {
  it('vynechá smazané zakázky, položky a katalog', () => {
    const plan = buildMigrationPlan(legacy());
    expect(plan.jobs.map((j) => j.id)).toEqual(['job-1']);
    expect(plan.catalog.map((c) => c.id)).toEqual(['cat-sky']);
    const names = plan.jobItems.map((i) => i.name);
    expect(names).not.toContain('Kabel');
    expect(names).not.toContain('Dedo');
    expect(plan.jobItems.some((i) => i.id === 'orphan' || i.id === 'nojob')).toBe(false);
  });

  it('sloučí duplicitní záznamy stejné techniky', () => {
    const sky = buildMigrationPlan(legacy()).jobItems.filter((i) => i.name === 'SkyPanel S60-C');
    expect(sky).toHaveLength(1);
    expect(sky[0]).toMatchObject({ id: 'a', quantityRequested: 5, quantityLoaded: 2, status: 'PENDING', serialNumber: 'SKY-2' });
  });

  it('každý záznam má jedinečné ID a žádné undefined hodnoty', () => {
    const plan = buildMigrationPlan(legacy());
    const noId = plan.jobItems.find((i) => i.name === 'Bez ID');
    expect(noId.id).toMatch(/^legacy-item-/);
    const logIds = plan.auditLogs.map((l) => l.id);
    expect(new Set(logIds).size).toBe(logIds.length);
    expect(plan.auditLogs).toHaveLength(2);
    expect(JSON.stringify(plan)).not.toContain('undefined');
    expect(plan.jobItems.find((i) => i.id === 'a')).not.toHaveProperty('serialNumber', undefined);
  });

  it('auditní log se omezí na posledních 300 záznamů', () => {
    const logs = Array.from({ length: 450 }, (_, i) => ({ id: `l${i}`, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() }));
    const plan = buildMigrationPlan({ auditLogs: logs });
    expect(plan.auditLogs).toHaveLength(AUDIT_LIMIT);
    expect(plan.auditLogs[0].id).toBe('l449');
  });

  it('ukázková data se převedou celá a každý dokument se vejde do limitu Firestore', () => {
    const plan = buildMigrationPlan({ jobs: INITIAL_JOBS, jobItems: INITIAL_JOB_ITEMS, catalog: INITIAL_CATALOG, consumables: INITIAL_CONSUMABLES });
    expect(plan.jobs).toHaveLength(INITIAL_JOBS.length);
    expect(plan.catalog).toHaveLength(INITIAL_CATALOG.length);
    for (const records of Object.values(plan)) {
      for (const r of records) expect(new TextEncoder().encode(JSON.stringify(r)).length).toBeLessThan(1_000_000);
    }
  });
});

// Minimal fake of the Firestore functions migrateLegacyStore() uses.
function fakeFirestore(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const snap = (path) => ({ exists: () => docs.has(path), data: () => docs.get(path) });
  let batches = 0;
  const fs = {
    db: {},
    doc: (_db, ...segments) => segments.join('/'),
    getDoc: async (path) => snap(path),
    runTransaction: async (_db, fn) => fn({ get: async (p) => snap(p), set: (p, d) => docs.set(p, d) }),
    writeBatch: () => {
      const ops = [];
      const b = {
        set: (p, d) => { ops.push([p, d]); return b; },
        commit: async () => { if (ops.length > 500) throw new Error('batch > 500'); batches++; ops.forEach(([p, d]) => docs.set(p, d)); },
      };
      return b;
    },
  };
  return { fs, docs, batches: () => batches };
}

describe('běh migrace', () => {
  let f;
  beforeEach(() => { f = fakeFirestore({ 'inventory_store/blp_main_store': legacy() }); });

  it('převede data do kolekcí a zapíše značku hotovo', async () => {
    const res = await migrateLegacyStore(f.fs, { user: 'tester' });
    expect(res.status).toBe('done');
    expect(f.docs.get('jobs/job-1')).toMatchObject({ name: 'Reklama Test' });
    expect(f.docs.get('jobItems/a')).toMatchObject({ quantityRequested: 5 });
    expect(f.docs.get('meta/migration_v3')).toMatchObject({ status: 'done', by: 'tester' });
    expect(f.docs.has('inventory_store/blp_main_store')).toBe(true); // legacy stays as backup
  });

  it('druhé spuštění (nebo jiný telefon) migraci přeskočí', async () => {
    await migrateLegacyStore(f.fs);
    f.docs.set('jobs/job-1', { name: 'Upraveno po migraci' });
    expect((await migrateLegacyStore(f.fs)).status).toBe('skipped');
    expect(f.docs.get('jobs/job-1').name).toBe('Upraveno po migraci');
  });

  it('rozběhnutou migraci jiného zařízení nepřebírá, zaseknutou po 10 min ano', async () => {
    f.docs.set('meta/migration_v3', { status: 'running', startedAt: new Date().toISOString() });
    expect((await migrateLegacyStore(f.fs)).status).toBe('skipped');
    f.docs.set('meta/migration_v3', { status: 'running', startedAt: new Date(Date.now() - 11 * 60_000).toISOString() });
    expect((await migrateLegacyStore(f.fs)).status).toBe('done');
  });

  it('bez starého dokumentu jen označí migraci jako hotovou', async () => {
    const empty = fakeFirestore();
    expect((await migrateLegacyStore(empty.fs)).status).toBe('empty');
    expect(empty.docs.get('meta/migration_v3')).toMatchObject({ status: 'done', empty: true });
  });

  it('velká data zapisuje po dávkách menších než 500', async () => {
    const big = legacy();
    big.jobItems = Array.from({ length: 1200 }, (_, i) => makeItem({ id: `i${i}`, name: `Kus ${i}` }));
    const g = fakeFirestore({ 'inventory_store/blp_main_store': big });
    await migrateLegacyStore(g.fs);
    expect(g.docs.get('jobItems/i1199')).toBeTruthy();
    expect(g.batches()).toBeGreaterThanOrEqual(4);
  });
});
