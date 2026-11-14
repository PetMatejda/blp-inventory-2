// Item state machine — FUNKCNI_SPECIFIKACE.md, section 4.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/services/firebase.js', () => ({
  db: {},
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(async () => {}),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}));

import { storageService } from '../src/services/storageService.js';
import { seedLocal, makeJob, makeItem, KEYS, readLocal } from './helpers.js';

const USER = 'Tester (ADMIN)';
const getItem = (id = 'ji-1') => readLocal(KEYS.JOB_ITEMS).find(i => i.id === id);

describe('stavový automat položky', () => {
  beforeEach(() => {
    seedLocal({ jobs: [makeJob()], items: [makeItem({ quantityRequested: 4 })] });
  });

  it('přičtení na plný počet v nakládce → LOADED', () => {
    storageService.updateItemQuantity('ji-1', 4, USER, 'LOADING');
    expect(getItem()).toMatchObject({ quantityLoaded: 4, status: 'LOADED' });
  });

  it('přičtení na plný počet v deriggingu → PACKED', () => {
    storageService.updateItemQuantity('ji-1', 4, USER, 'DERIGGING');
    expect(getItem()).toMatchObject({ quantityLoaded: 4, status: 'PACKED' });
  });

  it('částečné množství zůstává PENDING', () => {
    storageService.updateItemQuantity('ji-1', 2, USER, 'LOADING');
    expect(getItem()).toMatchObject({ quantityLoaded: 2, status: 'PENDING' });
  });

  it('odečtení z LOADED pod 100 % vrátí stav na PENDING (Decrement Rule)', () => {
    storageService.updateItemQuantity('ji-1', 4, USER, 'LOADING');
    storageService.updateItemQuantity('ji-1', -1, USER, 'LOADING');
    expect(getItem()).toMatchObject({ quantityLoaded: 3, status: 'PENDING' });
  });

  it('množství nikdy neklesne pod 0', () => {
    storageService.updateItemQuantity('ji-1', -5, USER, 'LOADING');
    expect(getItem().quantityLoaded).toBe(0);
  });

  it('přičtení nad požadavek navýší požadovaný počet (současné chování)', () => {
    storageService.updateItemQuantity('ji-1', 5, USER, 'LOADING');
    expect(getItem()).toMatchObject({ quantityLoaded: 5, quantityRequested: 5, status: 'LOADED' });
  });

  it('swipe doprava naloží plný počet, swipe doleva vrátí na 0', () => {
    storageService.setItemLoadedOrPacked('ji-1', USER, 'LOADING');
    expect(getItem()).toMatchObject({ quantityLoaded: 4, status: 'LOADED' });
    storageService.setItemPending('ji-1', USER, 'LOADING');
    expect(getItem()).toMatchObject({ quantityLoaded: 0, status: 'PENDING' });
  });

  it('swipe doleva v deriggingu vrátí položku „na place“ (LOADED)', () => {
    storageService.setItemLoadedOrPacked('ji-1', USER, 'DERIGGING');
    expect(getItem().status).toBe('PACKED');
    storageService.setItemPending('ji-1', USER, 'DERIGGING');
    expect(getItem()).toMatchObject({ quantityLoaded: 4, status: 'LOADED' });
  });

  it('každá změna zapíše auditní záznam a nastaví updatedAt', () => {
    storageService.updateItemQuantity('ji-1', 1, USER, 'LOADING');
    expect(readLocal(KEYS.AUDIT_LOGS)[0]).toMatchObject({ user: USER, jobId: 'job-1', type: 'loaded' });
    expect(getItem().updatedAt).not.toBe('2026-11-01T10:00:00.000Z');
  });
});

describe('závady', () => {
  beforeEach(() => {
    seedLocal({ jobs: [makeJob()], items: [makeItem({ quantityRequested: 4, quantityLoaded: 2 })] });
  });

  it('nahlášení závady nastaví DAMAGED, závažnost a popis', () => {
    storageService.reportItemDamage('ji-1', 'CRITICAL', 'Prasklá výbojka', null, USER);
    expect(getItem()).toMatchObject({ status: 'DAMAGED', damageSeverity: 'CRITICAL', damageNotes: 'Prasklá výbojka' });
  });

  it('bez fotky se k závadě žádná fotka neuloží', () => {
    storageService.reportItemDamage('ji-1', 'MAJOR', 'Nesvítí', null, USER);
    expect(getItem().photoUrls).toEqual([]);
  });

  it('zrušení závady s neúplným počtem → PENDING a počet zůstane (spec 4.2 bod 4)', () => {
    storageService.reportItemDamage('ji-1', 'MAJOR', 'Nesvítí', null, USER);
    storageService.toggleItemStatus('ji-1', USER, 'LOADING');
    expect(getItem()).toMatchObject({ status: 'PENDING', quantityLoaded: 2, damageNotes: '', photoUrls: [] });
  });

  it('zrušení závady s plným počtem → LOADED', () => {
    seedLocal({ jobs: [makeJob()], items: [makeItem({ quantityRequested: 4, quantityLoaded: 4 })] });
    storageService.reportItemDamage('ji-1', 'MAJOR', 'Nesvítí', 'https://x/foto.jpg', USER);
    storageService.toggleItemStatus('ji-1', USER, 'LOADING');
    expect(getItem()).toMatchObject({ status: 'LOADED', quantityLoaded: 4, damageNotes: '', photoUrls: [] });
  });
});

describe('zakázky', () => {
  beforeEach(() => {
    seedLocal({ jobs: [makeJob()], items: [makeItem()] });
  });

  it('ukončení zakázky ji archivuje a obnovení vrátí do ACTIVE', () => {
    storageService.finishJob('job-1', USER);
    expect(storageService.getJobs()[0].status).toBe('ARCHIVED');
    storageService.reactivateJob('job-1', USER);
    expect(storageService.getJobs()[0].status).toBe('ACTIVE');
  });

  it('přepnutí režimu Rigging ↔ Derigging nastaví nový updatedAt', () => {
    storageService.toggleJobMode('job-1', USER);
    const job = storageService.getJobs()[0];
    expect(job.mode).toBe('DERIGGING');
    expect(job.updatedAt).not.toBe('2026-11-01T10:00:00.000Z');
  });

  it('kopie zakázky ze vzoru zkopíruje položky s nulovým stavem', () => {
    seedLocal({ jobs: [makeJob()], items: [makeItem({ quantityLoaded: 4, status: 'LOADED' })] });
    const copy = storageService.duplicateJobAsTemplate('job-1', { name: 'Den 2' }, USER);
    const copiedItems = storageService.getJobItems(copy.id);
    expect(copiedItems).toHaveLength(1);
    expect(copiedItems[0]).toMatchObject({ quantityLoaded: 0, status: 'PENDING', quantityRequested: 4 });
    expect(copy.updatedAt).toBeTruthy();
  });

  it('smazání zakázky odstraní i její položky', () => {
    storageService.deleteJob('job-1', USER);
    expect(storageService.getJobs()).toHaveLength(0);
    expect(storageService.getJobItems(null)).toHaveLength(0);
  });
});
