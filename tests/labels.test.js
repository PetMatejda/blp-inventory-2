// One vocabulary per phase: labels, filters and phase summary.
import { describe, it, expect } from 'vitest';
import { statusLabel, filtersFor, matchesFilter, filterCounts, phaseSummary, phaseOf, plural } from '../src/domain/labels.js';
import { makeItem } from './helpers.js';

const items = [
  makeItem({ id: 'p', status: 'PENDING', quantityRequested: 4, quantityLoaded: 1 }),
  makeItem({ id: 'l', status: 'LOADED', quantityRequested: 2, quantityLoaded: 2 }),
  makeItem({ id: 'k', status: 'PACKED', quantityRequested: 1, quantityLoaded: 1 }),
  makeItem({ id: 'd', status: 'DAMAGED', quantityRequested: 1, quantityLoaded: 0 }),
];
const ids = (list) => list.map((i) => i.id).sort();

describe('slovník stavů podle fáze', () => {
  it('rigging mluví o nakládce, derigging o placu a balení', () => {
    expect(statusLabel('PENDING', 'LOADING')).toBe('K naložení');
    expect(statusLabel('LOADED', 'LOADING')).toBe('Naloženo');
    expect(statusLabel('LOADED', 'DERIGGING')).toBe('Na placu');
    expect(statusLabel('PACKED', 'DERIGGING')).toBe('Sbaleno');
    expect(statusLabel('DAMAGED', 'DERIGGING')).toBe('Závada');
  });

  it('filtry mají výchozí „Zbývá …“ podle fáze', () => {
    expect(filtersFor('LOADING')[0]).toEqual({ id: 'REMAINING', label: 'Zbývá naložit' });
    expect(filtersFor('DERIGGING')[0]).toEqual({ id: 'REMAINING', label: 'Zbývá sbalit' });
    expect(filtersFor('DERIGGING').map((f) => f.id)).toEqual(['REMAINING', 'DONE', 'DAMAGED', 'ALL']);
  });

  it('„Zbývá“ v riggingu = vše kromě naloženého/sbaleného a závad', () => {
    expect(ids(items.filter((i) => matchesFilter(i, 'REMAINING', 'LOADING')))).toEqual(['p']);
    expect(ids(items.filter((i) => matchesFilter(i, 'DONE', 'LOADING')))).toEqual(['k', 'l']);
  });

  it('„Zbývá“ v deriggingu = vše kromě sbaleného a závad', () => {
    expect(ids(items.filter((i) => matchesFilter(i, 'REMAINING', 'DERIGGING')))).toEqual(['l', 'p']);
    expect(ids(items.filter((i) => matchesFilter(i, 'DONE', 'DERIGGING')))).toEqual(['k']);
  });

  it('počty pro filtry', () => {
    expect(filterCounts(items, 'LOADING')).toEqual({ REMAINING: 1, DONE: 2, DAMAGED: 1, ALL: 4 });
  });

  it('české skloňování počtu', () => {
    const p = (n) => `${n} ${plural(n, 'položka', 'položky', 'položek')}`;
    expect([0, 1, 2, 4, 5, 11, 22].map(p)).toEqual(['0 položek', '1 položka', '2 položky', '4 položky', '5 položek', '11 položek', '22 položek']);
  });

  it('souhrn fáze pro ukončení zakázky', () => {
    const s = phaseSummary(items, 'LOADING');
    expect(s).toMatchObject({ total: 4, done: 2, missingPieces: 3 });
    expect(ids(s.damaged)).toEqual(['d']);
    expect(phaseOf('NEZNAMY').id).toBe('LOADING');
  });
});
