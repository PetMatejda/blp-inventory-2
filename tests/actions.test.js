// User actions against an in-memory data store (same interface as Firestore repo).
import { describe, it, expect, beforeEach } from 'vitest';
import { createInventoryActions } from '../src/services/inventoryActions.js';
import { createMemoryRepo } from './memoryRepo.js';
import { makeJob, makeItem, makeCatalogItem } from './helpers.js';

let mem;
let actions;
const setup = (seed) => {
  mem = createMemoryRepo(seed);
  actions = createInventoryActions({ repo: mem.repo, getState: mem.state, getActor: () => 'Tester (ADMIN)' });
};
const items = (jobId = 'job-1') => mem.all('jobItems').filter((i) => i.jobId === jobId);
const lastAudit = () => mem.all('auditLogs').at(-1);

describe('položky zakázky', () => {
  beforeEach(() => setup({ jobs: [makeJob()], jobItems: [makeItem()], catalog: [makeCatalogItem()] }));

  it('stepper uloží nový stav, čas, autora a auditní záznam v jednom zápisu', () => {
    actions.updateItemQuantity('ji-1', 4, 'LOADING');
    expect(items()[0]).toMatchObject({ quantityLoaded: 4, status: 'LOADED', updatedBy: 'Tester (ADMIN)' });
    expect(items()[0].updatedAt).toBeTruthy();
    expect(lastAudit()).toMatchObject({ jobId: 'job-1', user: 'Tester (ADMIN)', type: 'loaded' });
    expect(mem.log.at(-1)).toEqual({ type: 'batch', size: 2 });
  });

  it('smazanou položku jde do stejné zakázky přidat znovu (dříve chyba B1)', () => {
    actions.deleteJobItem('ji-1');
    expect(items()).toHaveLength(0);
    actions.addCatalogItemToJob('job-1', makeCatalogItem());
    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ name: 'SkyPanel S60-C', quantityRequested: 1, catalogId: 'cat-sky' });
  });

  it('odebranou položku jde vrátit zpět se stejnými daty (Vrátit)', () => {
    actions.updateItemQuantity('ji-1', 3, 'LOADING');
    const removed = actions.deleteJobItem('ji-1');
    expect(items()).toHaveLength(0);
    actions.restoreJobItem(removed);
    expect(items()).toEqual([expect.objectContaining({ id: 'ji-1', quantityLoaded: 3, name: 'SkyPanel S60-C' })]);
    expect(lastAudit().action).toBe('Vrácení odebrané položky');
  });

  it('opakované přidání z katalogu navýší počet a vrátí hotovou položku do PENDING', () => {
    actions.setItemLoadedOrPacked('ji-1', 'LOADING');
    actions.addCatalogItemToJob('job-1', makeCatalogItem());
    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ quantityRequested: 5, quantityLoaded: 4, status: 'PENDING' });
  });

  it('set se rozbalí na samostatné položky', () => {
    const set = makeCatalogItem({ id: 'set', name: 'Set', isBundle: true, bundleItems: [{ name: 'SkyPanel S60-C', qty: 1 }, { name: 'Kabel', qty: 2 }] });
    actions.addCatalogItemToJob('job-1', set);
    expect(items().map((i) => [i.name, i.quantityRequested]).sort()).toEqual([['Kabel', 2], ['SkyPanel S60-C', 5]]);
  });

  it('Ad-Hoc položka: nová, pak navýšení stejné', () => {
    actions.addAdHocItem('job-1', 'Žebřík', 'Grip', 1);
    actions.addAdHocItem('job-1', 'Žebřík', 'Grip', 2);
    const adhoc = items().filter((i) => i.isAdHoc);
    expect(adhoc).toHaveLength(1);
    expect(adhoc[0]).toMatchObject({ name: 'Žebřík (Ad-Hoc)', quantityRequested: 3 });
  });

  it('závada a její zrušení', () => {
    actions.updateItemQuantity('ji-1', 2, 'LOADING');
    actions.reportItemDamage('ji-1', 'CRITICAL', 'Jiskří', 'photo:abc');
    expect(items()[0]).toMatchObject({ status: 'DAMAGED', damageSeverity: 'CRITICAL', photoUrls: ['photo:abc'] });
    expect(lastAudit().type).toBe('damage');
    actions.toggleItemStatus('ji-1', 'LOADING');
    expect(items()[0]).toMatchObject({ status: 'PENDING', quantityLoaded: 2, damageNotes: '', photoUrls: [] });
  });

  it('neexistující položka nic nezapíše', () => {
    const before = mem.log.length;
    expect(actions.updateItemQuantity('missing', 1, 'LOADING')).toBeNull();
    expect(mem.log.length).toBe(before);
  });
});

describe('zakázky', () => {
  beforeEach(() => setup({ jobs: [makeJob()], jobItems: [makeItem(), makeItem({ id: 'ji-2', name: 'Kabel' })] }));

  it('nová zakázka má výchozí stav a audit', () => {
    const job = actions.createJob({ name: 'Nová' });
    expect(mem.all('jobs').find((j) => j.id === job.id)).toMatchObject({ name: 'Nová', status: 'ACTIVE', mode: 'LOADING' });
    expect(lastAudit()).toMatchObject({ jobId: job.id, type: 'add' });
  });

  it('ukončení a obnovení zakázky', () => {
    actions.setJobStatus('job-1', 'ARCHIVED');
    expect(mem.all('jobs')[0].status).toBe('ARCHIVED');
    actions.setJobStatus('job-1', 'ACTIVE');
    expect(mem.all('jobs')[0].status).toBe('ACTIVE');
  });

  it('přepnutí režimu Rigging ↔ Derigging', () => {
    actions.toggleJobMode('job-1');
    expect(mem.all('jobs')[0].mode).toBe('DERIGGING');
    actions.toggleJobMode('job-1');
    expect(mem.all('jobs')[0].mode).toBe('LOADING');
  });

  it('smazání zakázky odstraní i všechny její položky', () => {
    actions.deleteJob('job-1');
    expect(mem.all('jobs')).toHaveLength(0);
    expect(mem.all('jobItems')).toHaveLength(0);
  });

  it('kopie ze vzoru vytvoří novou zakázku s vynulovanými položkami', () => {
    actions.updateItemQuantity('ji-1', 4, 'LOADING');
    const job = actions.duplicateJobAsTemplate('job-1', { name: 'Den 2' });
    expect(items(job.id)).toHaveLength(2);
    expect(items(job.id).every((i) => i.quantityLoaded === 0 && i.status === 'PENDING')).toBe(true);
    expect(items('job-1')).toHaveLength(2);
  });

  it('velká zakázka se kopíruje po dávkách do 500 zápisů', () => {
    const many = Array.from({ length: 900 }, (_, i) => makeItem({ id: `m${i}`, name: `Kus ${i}` }));
    setup({ jobs: [makeJob()], jobItems: many });
    const job = actions.duplicateJobAsTemplate('job-1', { name: 'Kopie' });
    expect(items(job.id)).toHaveLength(900);
    actions.deleteJob('job-1');
    expect(items('job-1')).toHaveLength(0);
  });
});

describe('katalog a Brácha', () => {
  beforeEach(() => setup({
    jobs: [makeJob()], jobItems: [makeItem()], catalog: [makeCatalogItem()],
    consumables: [{ id: 'con-1', name: 'Gaffa', state: 0 }],
  }));

  it('přejmenování v katalogu přejmenuje i položky v zakázkách', () => {
    actions.updateCatalogItem('cat-sky', { name: 'SkyPanel S60-C v2' });
    expect(mem.all('catalog')[0].name).toBe('SkyPanel S60-C v2');
    expect(items()[0].name).toBe('SkyPanel S60-C v2');
  });

  it('přidání a smazání položky katalogu', () => {
    const c = actions.createCatalogItem({ name: 'Dedo', availableCount: '3' });
    expect(mem.all('catalog').find((x) => x.id === c.id)).toMatchObject({ name: 'Dedo', availableCount: 3, category: 'Lights' });
    actions.deleteCatalogItem(c.id);
    expect(mem.all('catalog').find((x) => x.id === c.id)).toBeUndefined();
  });

  it('stav spotřebáku', () => {
    actions.updateConsumableState('con-1', 2);
    expect(mem.all('consumables')[0]).toMatchObject({ state: 2, stateLabel: 'REFILL' });
    expect(lastAudit().type).toBe('bracha');
  });
});
