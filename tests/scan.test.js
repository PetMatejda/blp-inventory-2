// Labels and scanning of labelled units on jobs (phase 4b).
import { describe, it, expect, beforeEach } from 'vitest';
import { nextUnitCodes, resolveCode, unitScanProblem, missingUnitIds, catalogLabelPayload, codeKey, catalogIdsByCode } from '../src/domain/labels-qr.js';
import { createStockActions } from '../src/services/stockActions.js';
import { createMemoryRepo } from './memoryRepo.js';
import { makeJob, makeItem, makeCatalogItem } from './helpers.js';

describe('kódy a rozpoznání skenu', () => {
  it('další volné kódy kusů s prefixem', () => {
    expect(nextUnitCodes('sky', ['SKY-001', 'sky-003'], 3)).toEqual(['SKY-002', 'SKY-004', 'SKY-005']);
    expect(nextUnitCodes('Flat Light!', [], 1)).toEqual(['FLAT-LIGHT-001']);
  });

  const units = [{ id: 'u1', catalogId: 'sky', code: 'SKY-001', serialNumber: 'X9', status: 'IN_STOCK' }];
  const jobItems = [
    makeItem({ id: 'i1', catalogId: 'sky' }),
    makeItem({ id: 'i2', catalogId: 'cab', name: 'Kabel', barcode: '8590001', serialNumber: 'CAB-1, CAB-2' }),
  ];
  const catalog = [makeCatalogItem({ id: 'sky' }), makeCatalogItem({ id: 'dedo', name: 'Dedo' })];

  it('štítek kusu, SN kusu, štítek katalogu, EAN, SN položky, katalog mimo zakázku, neznámý', () => {
    expect(resolveCode('sky-001', { jobItems, catalog, units })).toMatchObject({ kind: 'UNIT', unit: units[0], item: jobItems[0] });
    expect(resolveCode('x9', { jobItems, catalog, units }).kind).toBe('UNIT');
    expect(resolveCode(catalogLabelPayload({ id: 'cab' }), { jobItems, catalog, units })).toMatchObject({ kind: 'ITEM', item: jobItems[1] });
    expect(resolveCode('8590001', { jobItems, catalog, units }).item.id).toBe('i2');
    expect(resolveCode('cab-2', { jobItems, catalog, units }).item.id).toBe('i2');
    expect(resolveCode('BLP:dedo', { jobItems, catalog, units })).toMatchObject({ kind: 'CATALOG' });
    expect(resolveCode('nic', { jobItems, catalog, units }).kind).toBe('UNKNOWN');
  });

  it('úvodní nuly na starých štítcích nevadí (štítek 000241, kus 241)', () => {
    const comsys = [{ id: 'zs-241', catalogId: 'sky', code: '241', serialNumber: '241', status: 'IN_STOCK' }, { id: 'u7', catalogId: 'dedo', code: '0070', status: 'IN_STOCK' }];
    expect(codeKey(' 000241 ')).toBe('241');
    expect(codeKey('000')).toBe('0');
    expect(codeKey('FL-001')).toBe('fl-001'); // only codes made of digits lose zeros
    expect(resolveCode('000241', { jobItems, catalog, units: comsys })).toMatchObject({ kind: 'UNIT', unit: comsys[0] });
    expect(resolveCode('241', { jobItems, catalog, units: comsys }).unit.id).toBe('zs-241');
    expect(resolveCode('70', { jobItems, catalog, units: comsys }).unit.id).toBe('u7');
    expect(resolveCode('0008590001', { jobItems, catalog, units: comsys }).item.id).toBe('i2');
    expect(resolveCode('2410', { jobItems, catalog, units: comsys }).kind).toBe('UNKNOWN');
  });

  it('číslo ze štítku napsané do hledání najde položku kusu', () => {
    const comsys = [{ id: 'zs-241', catalogId: 'sky', code: '241', status: 'IN_STOCK' }, { id: 'zs-9', catalogId: 'dedo', code: '9', status: 'RETIRED' }];
    const cat = [...catalog, makeCatalogItem({ id: 'box', name: 'Krabice', barcode: '8590002' })];
    expect([...catalogIdsByCode('000241', { catalog: cat, units: comsys })]).toEqual(['sky']);
    expect([...catalogIdsByCode('8590002', { catalog: cat, units: comsys })]).toEqual(['box']);
    expect(catalogIdsByCode('9', { catalog: cat, units: comsys }).size).toBe(0); // retired unit
    expect(catalogIdsByCode('cloud', { catalog: cat, units: comsys }).size).toBe(0);
  });

  it('čárové kódy starých štítků Comsys (EC + interní číslo)', () => {
    const comsys = [{ id: 'zs-241', catalogId: 'sky', code: '241', serialNumber: '241', barcode: 'EC502', status: 'IN_STOCK' }];
    const cat = [...catalog, makeCatalogItem({ id: 'cab', name: 'Kabel', pieceBarcodes: ['EC12', 'EC13'] }), makeCatalogItem({ id: 'flat', name: 'Flatlight', pieceBarcodes: ['EC7'] })];
    expect(codeKey('EC0502')).toBe('ec502');
    expect(resolveCode('EC502', { jobItems, catalog: cat, units: comsys })).toMatchObject({ kind: 'UNIT', unit: comsys[0], item: jobItems[0] });
    expect(resolveCode('ec0502', { jobItems, catalog: cat, units: comsys }).kind).toBe('UNIT');
    // a piece tracked by count: the job line when the item is on the job, otherwise the catalog item
    expect(resolveCode('EC13', { jobItems, catalog: cat, units: comsys })).toMatchObject({ kind: 'ITEM', item: jobItems[1] });
    expect(resolveCode('EC007', { jobItems, catalog: cat, units: comsys })).toMatchObject({ kind: 'CATALOG', catalogItem: { id: 'flat' } });
    expect(resolveCode('EC5020', { jobItems, catalog: cat, units: comsys }).kind).toBe('UNKNOWN');
    expect([...catalogIdsByCode('ec502', { catalog: cat, units: comsys })]).toEqual(['sky']);
    expect([...catalogIdsByCode('EC12', { catalog: cat, units: comsys })]).toEqual(['cab']);
  });

  it('kdy kus nejde naskenovat', () => {
    const u = { id: 'u1', code: 'SKY-001', status: 'IN_STOCK' };
    expect(unitScanProblem({ ...u, status: 'IN_SERVICE' }, null, 'LOADING')).toMatch(/servisu/);
    expect(unitScanProblem({ ...u, status: 'RETIRED' }, null, 'RESTOCK')).toMatch(/vyřazený/);
    expect(unitScanProblem(u, { unitIds: ['u1'] }, 'LOADING')).toMatch(/už je naložený/);
    expect(unitScanProblem(u, { unitIds: ['u2'] }, 'RESTOCK', 'job-1')).toMatch(/nebyl na této zakázce/);
    expect(unitScanProblem(u, { unitIds: ['u1'] }, 'RESTOCK', 'job-1')).toBeNull();
    expect(missingUnitIds({ unitIds: ['a', 'b'], returnedUnitIds: ['b'] })).toEqual(['a']);
  });
});

describe('skenování kusů na zakázce', () => {
  let mem;
  let stock;
  const unitByCode = (code) => mem.all('stockUnits').find((u) => u.code === code);
  const item = (id = 'i1') => mem.all('jobItems').find((i) => i.id === id);

  beforeEach(() => {
    mem = createMemoryRepo({
      catalog: [makeCatalogItem({ id: 'sky', name: 'SkyPanel', category: 'Lights', serialPrefix: 'SKY', availableCount: 5 }), makeCatalogItem({ id: 'dedo', name: 'Dedo', category: 'Lights', serialPrefix: 'DED', availableCount: 2 })],
      jobs: [makeJob({ id: 'job-1', mode: 'LOADING' }), makeJob({ id: 'job-2', name: 'Jiná', mode: 'LOADING' })],
      jobItems: [makeItem({ id: 'i1', jobId: 'job-1', catalogId: 'sky', name: 'SkyPanel', quantityRequested: 2, quantityLoaded: 0, status: 'PENDING' })],
    });
    stock = createStockActions({ repo: mem.repo, getState: mem.state, getActor: () => 'Tester' });
    stock.initStockFromCatalog();
  });

  it('štítky pro existující kusy nemění počty a nepřekročí počet ve skladu', () => {
    expect(stock.labelExistingUnits('sky', 3)).toEqual(['SKY-001', 'SKY-002', 'SKY-003']);
    expect(stock.labelExistingUnits('sky', 10)).toEqual(['SKY-004', 'SKY-005']);
    expect(stock.labelExistingUnits('sky', 1)).toEqual([]);
    expect(mem.all('stockLevels').find((l) => l.id === 'sky').inStock).toBe(5);
    expect(mem.all('movements').filter((m) => m.type === 'LABEL')).toHaveLength(2);
  });

  it('nakládka: kus se zapíše k zakázce, podruhé se nepočítá, servisní kus se odmítne', () => {
    stock.labelExistingUnits('sky', 3);
    expect(stock.scanOnJob('job-1', 'SKY-001')).toMatchObject({ ok: true });
    expect(item()).toMatchObject({ quantityLoaded: 1, unitIds: [unitByCode('SKY-001').id] });
    expect(unitByCode('SKY-001')).toMatchObject({ jobId: 'job-1', jobName: 'Reklama Test' });
    expect(stock.scanOnJob('job-1', 'sky-001')).toMatchObject({ ok: false, message: expect.stringMatching(/už je naložený/) });
    stock.setUnitStatus(unitByCode('SKY-003').id, 'IN_SERVICE');
    expect(stock.scanOnJob('job-1', 'SKY-003')).toMatchObject({ ok: false, message: expect.stringMatching(/servisu/) });
    expect(stock.scanOnJob('job-1', 'SKY-002')).toMatchObject({ ok: true });
    expect(item()).toMatchObject({ quantityLoaded: 2, status: 'LOADED' });
  });

  it('kus jiné techniky nabídne přidání z katalogu; neznámý kód se odmítne', () => {
    stock.labelExistingUnits('dedo', 1);
    expect(stock.scanOnJob('job-1', 'DED-001')).toMatchObject({ ok: false, needsAdd: expect.objectContaining({ id: 'dedo' }) });
    expect(stock.scanOnJob('job-1', 'BLP:dedo')).toMatchObject({ ok: false, needsAdd: expect.objectContaining({ id: 'dedo' }) });
    expect(stock.scanOnJob('job-1', '???').message).toMatch(/Neznámý kód/);
  });

  it('kus vedený na jiné aktivní zakázce: projde s upozorněním', () => {
    stock.labelExistingUnits('sky', 1);
    mem.repo.commit([{ type: 'update', col: 'stockUnits', id: unitByCode('SKY-001').id, data: { jobId: 'job-2' } }]);
    expect(stock.scanOnJob('job-1', 'SKY-001')).toMatchObject({ ok: true, warning: expect.stringMatching(/Jiná/) });
  });

  it('celý cyklus: naloženo → sbaleno po kusech → naskladněno; nevrácený kus chybí jménem a inventura ho najde', () => {
    stock.labelExistingUnits('sky', 2);
    stock.scanOnJob('job-1', 'SKY-001');
    stock.scanOnJob('job-1', 'SKY-002');
    stock.issueJob('job-1');
    mem.repo.commit([{ type: 'update', col: 'jobs', id: 'job-1', data: { mode: 'DERIGGING' } }]);

    expect(stock.scanOnJob('job-1', 'SKY-001').message).toMatch(/sbaleno 1\/2/);
    expect(item().status).not.toBe('PACKED');
    stock.scanOnJob('job-1', 'SKY-002');
    expect(item().status).toBe('PACKED');

    stock.startRestock('job-1');
    expect(item()).toMatchObject({ quantityLoaded: 0, returnedUnitIds: [] });
    expect(stock.scanOnJob('job-1', 'SKY-002')).toMatchObject({ ok: true });
    expect(unitByCode('SKY-002').jobId).toBeNull();

    const plan = stock.finishRestock('job-1');
    expect(plan.__missingUnits).toEqual(['SKY-001']);
    expect(unitByCode('SKY-001').status).toBe('MISSING');
    expect(mem.all('jobs').find((j) => j.id === 'job-1').missingUnits).toEqual(['SKY-001']);
    expect(mem.all('stockLevels').find((l) => l.id === 'sky')).toMatchObject({ inStock: 4, missing: 1, onJob: 0 });

    // stocktake finds it
    const st = stock.startStocktake({ category: 'Lights' });
    stock.scanUnitCode(st, 'SKY-001');
    stock.scanUnitCode(st, 'SKY-002');
    const line = mem.state().stocktakeLines.find((l) => l.catalogId === 'sky');
    stock.setLineExtra(line.id, 3);
    stock.approveStocktake(st);
    expect(unitByCode('SKY-001')).toMatchObject({ status: 'IN_STOCK', jobId: null });
    expect(mem.all('stockLevels').find((l) => l.id === 'sky')).toMatchObject({ inStock: 5, missing: 0 });
  });

  it('chybějící kus ručně nalezený: zpět ve skladu, ubyde z „chybí“, pohyb Nalezeno', () => {
    stock.labelExistingUnits('sky', 1);
    const u = unitByCode('SKY-001');
    stock.setUnitStatus(u.id, 'MISSING');
    expect(mem.all('stockLevels').find((l) => l.id === 'sky')).toMatchObject({ inStock: 4, missing: 1 });
    mem.repo.commit([{ type: 'update', col: 'stockUnits', id: u.id, data: { jobId: 'job-1' } }]);
    stock.setUnitStatus(u.id, 'IN_STOCK');
    expect(mem.all('stockLevels').find((l) => l.id === 'sky')).toMatchObject({ inStock: 5, missing: 0 });
    expect(unitByCode('SKY-001').jobId).toBeNull();
    expect(mem.all('movements').at(-1).type).toBe('FOUND');
  });

  it('archivovaná zakázka sken odmítne', () => {
    mem.repo.commit([{ type: 'update', col: 'jobs', id: 'job-1', data: { status: 'ARCHIVED' } }]);
    expect(stock.scanOnJob('job-1', 'BLP:sky')).toMatchObject({ ok: false, message: expect.stringMatching(/archivu/) });
  });
});
