// Item state machine — FUNKCNI_SPECIFIKACE.md, section 4 (pure domain rules).
import { describe, it, expect } from 'vitest';
import {
  applyQuantityDelta, applyExactQuantity, markDone, markUndone, toggleStatus, reportDamage,
  expandBundle, copyItemsForTemplate, jobProgress, findSameEquipment,
} from '../src/domain/items.js';
import { makeItem, makeCatalogItem } from './helpers.js';

const item = (o) => makeItem({ quantityRequested: 4, quantityLoaded: 0, status: 'PENDING', ...o });

describe('stavový automat položky', () => {
  it('přičtení na plný počet: nakládka → LOADED, derigging → PACKED', () => {
    expect(applyQuantityDelta(item(), 4, 'LOADING')).toMatchObject({ quantityLoaded: 4, status: 'LOADED' });
    expect(applyQuantityDelta(item(), 4, 'DERIGGING')).toMatchObject({ quantityLoaded: 4, status: 'PACKED' });
  });

  it('částečné množství zůstává PENDING', () => {
    expect(applyQuantityDelta(item(), 2)).toMatchObject({ quantityLoaded: 2, status: 'PENDING' });
  });

  it('odečtení z LOADED pod 100 % vrátí PENDING (Decrement Rule)', () => {
    expect(applyQuantityDelta(item({ quantityLoaded: 4, status: 'LOADED' }), -1)).toMatchObject({ quantityLoaded: 3, status: 'PENDING' });
  });

  it('množství nikdy neklesne pod 0', () => {
    expect(applyQuantityDelta(item(), -5).quantityLoaded).toBe(0);
  });

  it('přičtení nad požadavek navýší požadovaný počet', () => {
    expect(applyQuantityDelta(item(), 5)).toMatchObject({ quantityLoaded: 5, quantityRequested: 5, status: 'LOADED' });
  });

  it('ruční zadání počtu', () => {
    expect(applyExactQuantity(item({ quantityLoaded: 1 }), 4)).toMatchObject({ quantityLoaded: 4, status: 'LOADED' });
    expect(applyExactQuantity(item(), 'abc')).toMatchObject({ quantityLoaded: 0 });
  });

  it('swipe: hotovo / zpět v obou režimech', () => {
    expect(markDone(item(), 'LOADING')).toEqual({ quantityLoaded: 4, status: 'LOADED' });
    expect(markDone(item(), 'DERIGGING')).toEqual({ quantityLoaded: 4, status: 'PACKED' });
    expect(markUndone(item({ quantityLoaded: 4, status: 'LOADED' }), 'LOADING')).toEqual({ quantityLoaded: 0, status: 'PENDING' });
    expect(markUndone(item({ quantityLoaded: 4, status: 'PACKED' }), 'DERIGGING')).toEqual({ quantityLoaded: 4, status: 'LOADED' });
  });

  it('zrušení závady: neúplný počet → PENDING a počet zůstane (spec 4.2 bod 4)', () => {
    const patch = toggleStatus(item({ quantityLoaded: 2, status: 'DAMAGED', damageNotes: 'x', photoUrls: ['p'] }));
    expect(patch).toMatchObject({ status: 'PENDING', damageNotes: '', photoUrls: [], damageSeverity: null });
    expect(patch).not.toHaveProperty('quantityLoaded');
  });

  it('zrušení závady: plný počet → LOADED', () => {
    expect(toggleStatus(item({ quantityLoaded: 4, status: 'DAMAGED' })).status).toBe('LOADED');
  });

  it('nahlášení závady přidá fotku jen když nějaká je', () => {
    expect(reportDamage(item(), 'MAJOR', 'Nesvítí', null)).toMatchObject({ status: 'DAMAGED', damageSeverity: 'MAJOR', photoUrls: [] });
    expect(reportDamage(item({ photoUrls: ['cat.jpg'] }), 'LIGHT', '', 'photo:1').photoUrls).toEqual(['cat.jpg', 'photo:1']);
  });
});

describe('sady, šablony, postup', () => {
  const bundle = makeCatalogItem({
    id: 'set-1', name: 'Set ARRI', isBundle: true,
    bundleItems: [{ name: 'SkyPanel S60-C', qty: 2 }, { name: 'Kabel 25m', qty: 3 }, { name: 'Kabel 25m', qty: 1 }],
  });

  it('rozbalení setu navýší existující položku a ostatní vytvoří (bez duplicit)', () => {
    const existing = item({ id: 'ji-1', name: 'SkyPanel S60-C' });
    const { updates, creates } = expandBundle('job-1', bundle, [existing], [makeCatalogItem()]);
    expect(updates).toEqual([{ item: existing, patch: { quantityRequested: 6 } }]);
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ name: 'Kabel 25m', quantityRequested: 4, jobId: 'job-1', status: 'PENDING' });
  });

  it('kopie ze šablony vynuluje stav a zahodí ID', () => {
    const [copy] = copyItemsForTemplate([item({ id: 'x', quantityLoaded: 4, status: 'DAMAGED', damageNotes: 'a' })], 'job-2');
    expect(copy).toMatchObject({ jobId: 'job-2', quantityLoaded: 0, status: 'PENDING', damageNotes: '', quantityRequested: 4 });
    expect(copy).not.toHaveProperty('id');
  });

  it('postup zakázky podle řádků a režimu', () => {
    const items = [item({ status: 'LOADED' }), item({ status: 'PENDING' }), item({ status: 'PACKED' })];
    expect(jobProgress(items, 'LOADING')).toEqual({ total: 3, done: 1, percent: 33 });
    expect(jobProgress([], 'LOADING').percent).toBe(0);
  });

  it('stejné vybavení se hledá podle katalogu nebo názvu jen v dané zakázce', () => {
    const items = [item({ id: 'a', jobId: 'job-1' }), item({ id: 'b', jobId: 'job-2', catalogId: 'cat-x', name: 'X' })];
    expect(findSameEquipment(items, 'job-1', { catalogId: 'cat-sky' })?.id).toBe('a');
    expect(findSameEquipment(items, 'job-1', { name: ' skypanel s60-c ' })?.id).toBe('a');
    expect(findSameEquipment(items, 'job-1', { catalogId: 'cat-x', name: 'X' })).toBeUndefined();
  });
});
