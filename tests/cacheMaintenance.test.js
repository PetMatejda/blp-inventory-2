// Emergency reset of the local Firestore cache and cleanup of legacy keys.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isFirestoreCacheDb, clearFirestoreCache, resetLocalCacheIfRequested, removeLegacyLocalData, LEGACY_LOCAL_KEYS,
} from '../src/services/cacheMaintenance.js';

describe('údržba dat v prohlížeči', () => {
  beforeEach(() => {
    const deleted = [];
    globalThis.__deleted = deleted;
    globalThis.indexedDB = {
      databases: vi.fn(async () => [{ name: 'firestore/[DEFAULT]/blp-inventory/main' }, { name: 'firebaseLocalStorageDb' }, { name: 'firestore/[DEFAULT]/blp-inventory/main-x' }]),
      deleteDatabase: vi.fn((name) => { deleted.push(name); const req = {}; setTimeout(() => req.onsuccess?.()); return req; }),
    };
  });

  it('pozná databáze cache Firestore (přihlášení nechá být)', () => {
    expect(isFirestoreCacheDb('firestore/[DEFAULT]/blp-inventory/main')).toBe(true);
    expect(isFirestoreCacheDb('firebaseLocalStorageDb')).toBe(false);
  });

  it('smaže jen cache Firestore', async () => {
    const names = await clearFirestoreCache();
    expect(names).toHaveLength(2);
    expect(globalThis.__deleted).not.toContain('firebaseLocalStorageDb');
  });

  it('?reset-cache=1 cache smaže a parametr z adresy odstraní', async () => {
    window.history.replaceState(null, '', '/?reset-cache=1&x=2');
    expect(await resetLocalCacheIfRequested()).toBe(true);
    expect(globalThis.__deleted).toHaveLength(2);
    expect(window.location.search).toBe('?x=2');
    expect(await resetLocalCacheIfRequested()).toBe(false);
  });

  it('odstraní data staré verze aplikace, přihlášení a vybranou zakázku ponechá', () => {
    LEGACY_LOCAL_KEYS.forEach((k) => localStorage.setItem(k, 'x'));
    localStorage.setItem('blp_auth_user_v2', 'u');
    localStorage.setItem('blp_current_job_id_v2', 'job');
    removeLegacyLocalData();
    expect(LEGACY_LOCAL_KEYS.every((k) => localStorage.getItem(k) === null)).toBe(true);
    expect(localStorage.getItem('blp_auth_user_v2')).toBe('u');
    expect(localStorage.getItem('blp_current_job_id_v2')).toBe('job');
  });
});
