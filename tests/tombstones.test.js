// Tombstone format, including compatibility with entries already in the cloud.
import { describe, it, expect } from 'vitest';
import {
  indexTombstones, isItemTombstoned, matchKeysFor, stampKeys, LEGACY_CUTOFF,
} from '../src/services/tombstones.js';

const before = '2026-11-01T00:00:00.000Z';
const after = '2026-12-01T00:00:00.000Z';
const item = (o = {}) => ({ id: 'ji-9', jobId: 'job-1', catalogId: 'cat-1', name: 'Kabel 25m', updatedAt: before, ...o });

describe('tombstones', () => {
  it('ID náhrobek skryje položku natrvalo, i s novějším updatedAt', () => {
    const idx = indexTombstones(['ji-9']);
    expect(isItemTombstoned(item({ updatedAt: after }), idx)).toBe(true);
  });

  it('starý náhrobek podle názvu (bez času) skryje jen záznamy starší než LEGACY_CUTOFF', () => {
    const idx = indexTombstones(['job-1_name_kabel 25m']);
    expect(before < LEGACY_CUTOFF).toBe(true);
    expect(isItemTombstoned(item({ id: 'other', updatedAt: before }), idx)).toBe(true);
    expect(isItemTombstoned(item({ id: 'other', updatedAt: after }), idx)).toBe(false);
  });

  it('náhrobek s časem skryje jen záznamy změněné před smazáním', () => {
    const idx = indexTombstones(stampKeys(matchKeysFor(item()), '2026-11-15T00:00:00.000Z'));
    expect(isItemTombstoned(item({ id: 'dup', updatedAt: before }), idx)).toBe(true);
    expect(isItemTombstoned(item({ id: 'new', updatedAt: after }), idx)).toBe(false);
  });

  it('položka smazané zakázky je skrytá', () => {
    expect(isItemTombstoned(item(), indexTombstones([]), new Set(['job-1']))).toBe(true);
  });

  it('náhrobek jiné zakázky položku neskryje', () => {
    const idx = indexTombstones(stampKeys(matchKeysFor({ ...item(), jobId: 'job-2' }), after));
    expect(isItemTombstoned(item(), idx)).toBe(false);
  });

  it('názvy obsahující @ se nerozbijí', () => {
    const idx = indexTombstones(stampKeys(matchKeysFor(item({ name: 'Kabel @ 25m' })), after));
    expect(isItemTombstoned(item({ id: 'x', name: 'Kabel @ 25m' }), idx)).toBe(true);
  });
});
