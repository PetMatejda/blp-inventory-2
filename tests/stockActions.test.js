// Warehouse actions against the in-memory repo: counts, movements, job cycle, stocktake.
import { describe, it, expect, beforeEach } from 'vitest';
import { createStockActions } from '../src/services/stockActions.js';
import { createMemoryRepo } from './memoryRepo.js';
import { makeJob, makeItem, makeCatalogItem } from './helpers.js';

let mem;
let stock;
const setup = (seed) => {
  mem = createMemoryRepo(seed);
  stock = createStockActions({ repo: mem.repo, getState: mem.state, getActor: () => 'Skladník (ADMIN)' });
};
const level = (id) => mem.all('stockLevels').find((l) => l.id === id);
const movements = (type) => mem.all('movements').filter((m) => !type || m.type === type);

const catalog = [
  makeCatalogItem({ id: 'sky', name: 'SkyPanel', category: 'Lights', availableCount: 6 }),
  makeCatalogItem({ id: 'cab', name: 'Kabel 25m', category: 'Kábly', availableCount: 30 }),
  makeCatalogItem({ id: 'set', name: 'Set', isBundle: true, availableCount: 2 }),
];

describe('stav skladu', () => {
  beforeEach(() => setup({ catalog }));

  it('založení stavu z katalogu (sady se nezakládají) a druhé spuštění nic nezmění', () => {
    expect(stock.initStockFromCatalog()).toBe(2);
    expect(level('sky')).toMatchObject({ inStock: 6, onJob: 0, inService: 0 });
    expect(level('cab').inStock).toBe(30);
    expect(level('set')).toBeUndefined();
    expect(movements('INIT')).toHaveLength(2);
    expect(stock.initStockFromCatalog()).toBe(0);
  });

  it('příjem, vyřazení, servis a zpět — vždy s pohybem', () => {
    stock.initStockFromCatalog();
    stock.receive('cab', 5, 'nákup');
    stock.retire('cab', 2, 'přeseknutý');
    stock.toService('cab', 3);
    stock.fromService('cab', 1);
    expect(level('cab')).toMatchObject({ inStock: 31, inService: 2 });
    expect(movements().map((m) => m.type)).toEqual(['INIT', 'INIT', 'RECEIPT', 'RETIRE', 'TO_SERVICE', 'FROM_SERVICE']);
    expect(movements('RECEIPT')[0]).toMatchObject({ qty: 5, note: 'nákup', itemName: 'Kabel 25m', user: 'Skladník (ADMIN)' });
  });

  it('nulový nebo záporný počet nic nezapíše', () => {
    const before = mem.log.length;
    stock.receive('cab', 0);
    stock.retire('cab', -3);
    expect(mem.log.length).toBe(before);
  });

  it('kus se štítkem: příjem, duplicitní kód odmítnut, servis a vyřazení drží počty', () => {
    stock.initStockFromCatalog();
    expect(stock.addUnit('sky', 'SKY-001')).toBeNull();
    expect(stock.addUnit('sky', 'sky-001')).toMatch(/už má jiný kus/);
    const unit = mem.all('stockUnits')[0];
    expect(level('sky').inStock).toBe(7);
    stock.setUnitStatus(unit.id, 'IN_SERVICE');
    expect(level('sky')).toMatchObject({ inStock: 6, inService: 1 });
    stock.setUnitStatus(unit.id, 'RETIRED');
    expect(level('sky')).toMatchObject({ inStock: 6, inService: 0 });
  });
});

describe('zakázka: výdej → naskladnění', () => {
  beforeEach(() => {
    setup({
      catalog,
      jobs: [makeJob({ id: 'job-1', mode: 'LOADING' })],
      jobItems: [
        makeItem({ id: 'i1', catalogId: 'sky', quantityRequested: 4, quantityLoaded: 4, status: 'LOADED' }),
        makeItem({ id: 'i2', catalogId: 'cab', name: 'Kabel 25m', quantityRequested: 10, quantityLoaded: 10, status: 'LOADED' }),
        makeItem({ id: 'i3', catalogId: null, name: 'Žebřík (Ad-Hoc)', quantityRequested: 1, quantityLoaded: 1, status: 'LOADED' }),
      ],
    });
    stock.initStockFromCatalog();
  });

  it('výdej odepíše naložené kusy ze skladu jen jednou', () => {
    expect(stock.issueJob('job-1')).toEqual({ sky: 4, cab: 10 });
    expect(level('sky')).toMatchObject({ inStock: 2, onJob: 4 });
    expect(level('cab')).toMatchObject({ inStock: 20, onJob: 10 });
    expect(stock.issueJob('job-1')).toBeNull();
    expect(level('sky').inStock).toBe(2);
  });

  it('naskladnění: vrácené zpět, závada do servisu, chybějící evidováno; zakázka v archivu', () => {
    stock.issueJob('job-1');
    stock.startRestock('job-1');
    const items = () => mem.all('jobItems');
    expect(items().every((i) => i.quantityLoaded === 0 && i.status === 'PENDING')).toBe(true);
    expect(mem.all('jobs')[0].mode).toBe('RESTOCK');

    // counted back: 3 lights OK + 1 damaged, 9 of 10 cables
    mem.repo.commit([
      { type: 'update', col: 'jobItems', id: 'i1', data: { quantityLoaded: 3, status: 'PENDING' } },
      { type: 'set', col: 'jobItems', id: 'i1d', data: { ...items()[0], id: 'i1d', quantityRequested: 1, quantityLoaded: 1, status: 'DAMAGED' } },
      { type: 'update', col: 'jobItems', id: 'i2', data: { quantityLoaded: 9 } },
    ]);
    const plan = stock.finishRestock('job-1');
    expect(plan.sky).toEqual({ issued: 4, returned: 3, toService: 1, missing: 0 });
    expect(plan.cab).toEqual({ issued: 10, returned: 9, toService: 0, missing: 1 });
    expect(level('sky')).toMatchObject({ inStock: 5, onJob: 0, inService: 1, missing: 0 });
    expect(level('cab')).toMatchObject({ inStock: 29, onJob: 0, missing: 1 });
    expect(movements('MISSING')).toEqual([expect.objectContaining({ catalogId: 'cab', qty: 1, jobId: 'job-1' })]);
    expect(mem.all('jobs')[0].status).toBe('ARCHIVED');
  });

  it('zakázka založená před evidencí skladu (bez výdeje) sklad nenafoukne', () => {
    stock.startRestock('job-1');
    mem.repo.commit([{ type: 'update', col: 'jobItems', id: 'i1', data: { quantityLoaded: 3, status: 'DAMAGED' } }]);
    stock.finishRestock('job-1');
    expect(level('sky')).toMatchObject({ inStock: 3, inService: 3, onJob: 0 });
    expect(level('cab')).toMatchObject({ inStock: 30, onJob: 0, missing: 0 });
  });
});

describe('inventura', () => {
  beforeEach(() => {
    setup({ catalog });
    stock.initStockFromCatalog();
    stock.addUnit('sky', 'SKY-1');
    stock.addUnit('sky', 'SKY-2');
  });
  const openId = () => mem.all('stocktakes').find((s) => s.status === 'OPEN')?.id;
  const line = (catalogId) => mem.state().stocktakeLines.find((l) => l.catalogId === catalogId);

  it('jen jedna otevřená inventura; řádky s očekávaným stavem', () => {
    const id = stock.startStocktake();
    expect(stock.startStocktake()).toBeNull();
    expect(line('sky')).toMatchObject({ stocktakeId: id, expected: 8, tracking: 'SERIAL' });
    expect(line('cab')).toMatchObject({ expected: 30, tracking: 'QUANTITY' });
  });

  it('skenování kusů: známý kód, duplicita, neznámý kód; dva lidé najednou se nepřepíšou', () => {
    const id = stock.startStocktake();
    expect(stock.scanUnitCode(id, 'sky-1')).toMatchObject({ ok: true });
    expect(stock.scanUnitCode(id, 'SKY-1')).toMatchObject({ ok: true, duplicate: true });
    expect(stock.scanUnitCode(id, 'XYZ')).toMatchObject({ ok: false });
    stock.scanUnitCode(id, 'SKY-2'); // second person
    expect(line('sky').scannedUnitIds).toHaveLength(2);
  });

  it('schválení srovná sklad o rozdíl a zapíše pohyby; inventura se uzavře', () => {
    const id = stock.startStocktake();
    stock.scanUnitCode(id, 'SKY-1');
    stock.scanUnitCode(id, 'SKY-2');
    stock.setLineExtra(line('sky').id, 5);   // 7 of 8 lights
    stock.countLine(line('cab').id, 33);     // 3 cables more than expected
    stock.receive('cab', 2);                 // a delivery arrived during the stocktake
    const result = stock.approveStocktake(id);
    expect(result.differences.map((d) => [d.catalogId, d.diff])).toEqual([['sky', -1], ['cab', 3]]);
    expect(level('sky').inStock).toBe(7);
    expect(level('cab').inStock).toBe(35); // 30 + 2 delivery + 3 difference
    expect(movements('STOCKTAKE')).toHaveLength(2);
    expect(mem.all('stocktakes')[0]).toMatchObject({ status: 'APPROVED', approvedBy: 'Skladník (ADMIN)' });
    expect(mem.state().stocktakeLines).toHaveLength(0);
    expect(openId()).toBeUndefined();
  });

  it('nalezené kusy vedené jako chybějící se při inventuře odečtou z „chybí“', () => {
    mem.repo.commit([{ type: 'merge', col: 'stockLevels', id: 'cab', data: { inStock: { __inc: -2 }, missing: { __inc: 2 } } }]);
    const id = stock.startStocktake();
    stock.countLine(line('cab').id, 29); // expected 28, one piece found
    stock.approveStocktake(id);
    expect(level('cab')).toMatchObject({ inStock: 29, missing: 1 });
    expect(movements('STOCKTAKE')[0].note).toMatch(/nalezeno 1 ks/);
  });

  it('zrušená inventura sklad nemění', () => {
    const id = stock.startStocktake();
    stock.countLine(line('cab').id, 1);
    stock.cancelStocktake(id);
    expect(level('cab').inStock).toBe(30);
    expect(mem.all('stocktakes')[0].status).toBe('CANCELLED');
  });
});
