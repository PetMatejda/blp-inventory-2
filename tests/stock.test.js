// Warehouse domain: tracking type, availability in a date range, issue/restock, stocktake, CSV.
import { describe, it, expect } from 'vitest';
import {
  trackingOf, availability, jobsOverlap, issuePlan, restockPlan,
  buildStocktakeLines, stocktakeResult, countedOf, toCsv, ownedCount, levelOf, unitDetails,
} from '../src/domain/stock.js';
import { applyQuantityDelta, markDone, markUndone, enterRestock, toggleStatus } from '../src/domain/items.js';
import { phaseSummary, statusLabel, matchesFilter } from '../src/domain/labels.js';
import { makeJob, makeItem, makeCatalogItem } from './helpers.js';

const job = (id, from, to, o = {}) => makeJob({ id, riggingDate: from, deriggingDate: to, ...o });

describe('typ sledování', () => {
  it('světla a balasty po kusech, ostatní počtem; ruční nastavení má přednost', () => {
    expect(trackingOf({ category: 'Lights' })).toBe('SERIAL');
    expect(trackingOf({ category: 'Balasty & Zdroje' })).toBe('SERIAL');
    expect(trackingOf({ category: 'Kábly' })).toBe('QUANTITY');
    expect(trackingOf({ category: 'Grip' })).toBe('QUANTITY');
    expect(trackingOf({ category: 'Lights', trackingType: 'QUANTITY' })).toBe('QUANTITY');
  });
});

describe('dostupnost v termínu', () => {
  const jobs = [
    job('a', '2026-12-01', '2026-12-03'),
    job('b', '2026-12-03', '2026-12-05'),
    job('c', '2026-12-10', '2026-12-12'),
    job('old', '2026-12-01', '2026-12-05', { status: 'ARCHIVED' }),
  ];
  const jobItems = [
    makeItem({ id: 'ia', jobId: 'a', catalogId: 'sky', quantityRequested: 3 }),
    makeItem({ id: 'ib', jobId: 'b', catalogId: 'sky', quantityRequested: 2 }),
    makeItem({ id: 'ic', jobId: 'c', catalogId: 'sky', quantityRequested: 4 }),
    makeItem({ id: 'io', jobId: 'old', catalogId: 'sky', quantityRequested: 9 }),
  ];
  const levels = [{ id: 'sky', inStock: 4, onJob: 1, inService: 1, missing: 2 }];

  it('překrývání termínů včetně krajních dnů', () => {
    expect(jobsOverlap(jobs[0], jobs[1])).toBe(true);
    expect(jobsOverlap(jobs[0], jobs[2])).toBe(false);
  });

  it('vlastněné kusy = sklad + na zakázce + servis (ztracené ne)', () => {
    expect(ownedCount(levelOf(levels, 'sky'))).toBe(6);
  });

  it('počítá jen aktivní zakázky, které se termínem překrývají', () => {
    const r = availability('sky', jobs[0], { jobs, jobItems, levels });
    expect(r).toEqual({ owned: 6, reservedElsewhere: 2, requestedHere: 3, free: 1, short: 0 });
  });

  it('ohlásí nedostatek', () => {
    const r = availability('sky', jobs[1], { jobs, jobItems: [...jobItems, makeItem({ id: 'x', jobId: 'b', catalogId: 'sky', quantityRequested: 3 })], levels });
    expect(r.short).toBe(2);
  });

  it('bez založeného stavu skladu dostupnost neví (null)', () => {
    expect(availability('nic', jobs[0], { jobs, jobItems, levels })).toBeNull();
  });
});

describe('výdej a naskladnění', () => {
  const items = [
    makeItem({ id: '1', catalogId: 'sky', quantityRequested: 4, quantityLoaded: 4, status: 'LOADED' }),
    makeItem({ id: '2', catalogId: 'cab', quantityRequested: 10, quantityLoaded: 8, status: 'PENDING' }),
    makeItem({ id: '3', catalogId: null, quantityLoaded: 1 }),
  ];

  it('výdej = naložené kusy podle katalogu (Ad-Hoc bez katalogu se nepočítá)', () => {
    expect(issuePlan(items)).toEqual({ sky: 4, cab: 8 });
  });

  it('naskladnění: vrácené, do servisu a chybějící kusy', () => {
    const back = [
      makeItem({ id: '1', catalogId: 'sky', quantityRequested: 4, quantityLoaded: 3, status: 'PENDING' }),
      makeItem({ id: '1d', catalogId: 'sky', quantityRequested: 1, quantityLoaded: 1, status: 'DAMAGED' }),
      makeItem({ id: '2', catalogId: 'cab', quantityRequested: 10, quantityLoaded: 6, status: 'PENDING' }),
    ];
    expect(restockPlan(back, { sky: 4, cab: 8, dedo: 2 })).toEqual({
      sky: { issued: 4, returned: 3, toService: 1, missing: 0 },
      cab: { issued: 8, returned: 6, toService: 0, missing: 2 },
      dedo: { issued: 2, returned: 0, toService: 0, missing: 2 },
    });
  });

  it('fáze naskladnění: počítání od nuly, swipe = naskladněno, závada zůstává', () => {
    // packed in derigging → prefilled as restocked (no second count)
    expect(enterRestock(makeItem({ status: 'PACKED', quantityRequested: 4, quantityLoaded: 4 }))).toEqual({ quantityLoaded: 4, status: 'RESTOCKED' });
    expect(enterRestock(makeItem({ status: 'LOADED', quantityRequested: 4, quantityLoaded: 4 }))).toEqual({ quantityLoaded: 0, status: 'PENDING' });
    expect(enterRestock(makeItem({ status: 'PACKED', quantityLoaded: 2, unitIds: ['u1', 'u2'] }))).toEqual({ quantityLoaded: 0, status: 'PENDING' });
    expect(enterRestock(makeItem({ status: 'DAMAGED', quantityLoaded: 1 }))).toEqual({});
    expect(markDone(makeItem({ quantityRequested: 4 }), 'RESTOCK')).toEqual({ quantityLoaded: 4, status: 'RESTOCKED' });
    expect(markUndone(makeItem({ status: 'RESTOCKED' }), 'RESTOCK')).toEqual({ quantityLoaded: 0, status: 'PENDING' });
    expect(applyQuantityDelta(makeItem({ quantityRequested: 2, quantityLoaded: 1 }), 1, 'RESTOCK').status).toBe('RESTOCKED');
    expect(toggleStatus(makeItem({ status: 'RESTOCKED' }), 'RESTOCK')).toEqual({ quantityLoaded: 0, status: 'PENDING' });
    expect(statusLabel('RESTOCKED', 'RESTOCK')).toBe('Naskladněno');
    expect(matchesFilter(makeItem({ status: 'PENDING' }), 'REMAINING', 'RESTOCK')).toBe(true);
  });
});

describe('postup zakázky podle kusů', () => {
  const items = [
    makeItem({ id: 'a', quantityRequested: 40, quantityLoaded: 40, status: 'LOADED' }),
    makeItem({ id: 'b', quantityRequested: 1, quantityLoaded: 0, status: 'PENDING' }),
    makeItem({ id: 'c', quantityRequested: 9, quantityLoaded: 5, status: 'PENDING' }),
  ];
  it('rigging: naložené kusy / všechny kusy', () => {
    expect(phaseSummary(items, 'LOADING')).toMatchObject({ donePieces: 45, totalPieces: 50, percent: 90 });
  });
  it('derigging: jen sbalené kusy', () => {
    expect(phaseSummary([{ ...items[0], status: 'PACKED' }, items[1]], 'DERIGGING')).toMatchObject({ donePieces: 40, totalPieces: 41 });
  });
});

describe('inventura', () => {
  const catalog = [
    makeCatalogItem({ id: 'sky', category: 'Lights' }),
    makeCatalogItem({ id: 'cab', name: 'Kabel', category: 'Kábly' }),
    makeCatalogItem({ id: 'set', isBundle: true }),
  ];
  const levels = [{ id: 'sky', inStock: 3 }, { id: 'cab', inStock: 20 }];
  const units = [
    { id: 'u1', catalogId: 'sky', status: 'IN_STOCK' }, { id: 'u2', catalogId: 'sky', status: 'IN_STOCK' },
    { id: 'u3', catalogId: 'sky', status: 'RETIRED' },
  ];

  it('řádky inventury: očekávaný stav, typ sledování, sady se nepočítají', () => {
    const lines = buildStocktakeLines(catalog, levels, units);
    expect(lines.map((l) => [l.catalogId, l.tracking, l.expected])).toEqual([['sky', 'SERIAL', 3], ['cab', 'QUANTITY', 20]]);
    expect(lines[0].expectedUnitIds).toEqual(['u1', 'u2']);
    expect(buildStocktakeLines(catalog, levels, units, { category: 'Cables' }).map((l) => l.catalogId)).toEqual(['cab']);
  });

  it('napočítáno: naskenované kusy + ručně dopočítané', () => {
    expect(countedOf({ tracking: 'SERIAL', scannedUnitIds: ['u1'], extraCount: 1 })).toBe(2);
    expect(countedOf({ tracking: 'QUANTITY', counted: 0 })).toBe(0);
    expect(countedOf({ tracking: 'QUANTITY' })).toBeNull();
  });

  it('výsledek: rozdíly, shody a nespočítané řádky', () => {
    const r = stocktakeResult([
      { catalogId: 'sky', tracking: 'SERIAL', expected: 3, scannedUnitIds: ['u1', 'u2'], touched: true },
      { catalogId: 'cab', tracking: 'QUANTITY', expected: 20, counted: 20 },
      { catalogId: 'ded', tracking: 'QUANTITY', expected: 5 },
      { catalogId: 'new', tracking: 'QUANTITY', expected: 0, counted: 2 },
    ]);
    expect(r.matching).toBe(1);
    expect(r.differences.map((d) => [d.catalogId, d.diff])).toEqual([['sky', -1], ['new', 2]]);
    expect(r.notCounted.map((l) => l.catalogId)).toEqual(['ded']);
  });
});

describe('export CSV', () => {
  it('středník, BOM a escapování pro Excel', () => {
    const csv = toCsv([{ name: 'Kabel; 25m "PRO"', n: 3 }], [{ label: 'Název', value: 'name' }, { label: 'Ks', value: (r) => r.n * 2 }]);
    expect(csv).toBe('﻿Název;Ks\r\n"Kabel; 25m ""PRO""";6');
  });
});

describe('unitDetails', () => {
  it('lists what is known about a labelled piece', () => {
    expect(unitDetails({ code: '1634', condition: 'A', led: true, serialNumber: '5/2026' })).toEqual(['stav A', 'LED', 'v. č. 5/2026']);
    expect(unitDetails({ code: '1001', condition: 'B', led: false, serialNumber: '1001' })).toEqual(['stav B', 'bez LED']);
    expect(unitDetails({ code: '1', serialNumber: '1', revisionDate: '2022-06-27' })).toEqual(['revize 27. 6. 2022']);
    expect(unitDetails({ code: 'FLT-001' })).toEqual([]);
  });
});
