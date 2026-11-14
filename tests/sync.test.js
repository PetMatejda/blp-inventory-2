// Multi-device synchronisation: merge rules, tombstones and payload size.
// Each "device" is a snapshot of localStorage; the cloud document is whatever
// the mocked setDoc() received last, served back through the mocked getDoc().
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/services/firebase.js', () => ({
  db: {},
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(async () => {}),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}));

import { setDoc, getDoc } from '../src/services/firebase.js';
import { storageService } from '../src/services/storageService.js';
import { firebaseDb } from '../src/services/firebaseDb.js';
import {
  INITIAL_JOBS, INITIAL_JOB_ITEMS, INITIAL_CATALOG, INITIAL_CONSUMABLES, INITIAL_AUDIT_LOGS,
} from '../src/mockData/initialData.js';
import {
  seedLocal, makeJob, makeItem, makeCatalogItem, snapshotDevice, switchToDevice,
  docSnapshot, readLocal, KEYS, T0,
} from './helpers.js';

const USER = 'Tester (ADMIN)';

/** Push the current device state and return the payload written to "the cloud". */
async function pushFromCurrentDevice() {
  setDoc.mockClear();
  await storageService.pushCurrentState();
  return setDoc.mock.calls.at(-1)[1];
}

/** Pull a given cloud payload into the current device. */
async function pullIntoCurrentDevice(cloud) {
  getDoc.mockResolvedValueOnce(docSnapshot(cloud));
  const res = await firebaseDb.pullFromCloud();
  expect(res.success).toBe(true);
}

const visibleItems = (jobId = 'job-1') => storageService.getJobItems(jobId);

describe('náhrobky (smazané záznamy se nevracejí)', () => {
  beforeEach(() => {
    seedLocal({ jobs: [makeJob()], items: [makeItem()], catalog: [makeCatalogItem()] });
  });

  it('smazaná položka se nevrátí, i když ji pošle jiné zařízení', async () => {
    const stale = snapshotDevice(); // device B still has the item
    storageService.deleteJobItem('ji-1', USER);
    const cloud = await pushFromCurrentDevice();

    switchToDevice(stale);
    await pullIntoCurrentDevice({ ...cloud, jobItems: [makeItem()] });
    expect(visibleItems()).toHaveLength(0);
  });

  it('smazaná zakázka se nevrátí', async () => {
    storageService.deleteJob('job-1', USER);
    await pullIntoCurrentDevice({ jobs: [makeJob()], jobItems: [makeItem()], deletedJobIds: [] });
    expect(storageService.getJobs()).toHaveLength(0);
    expect(visibleItems()).toHaveLength(0);
  });

  it('smazanou položku z katalogu jde do stejné zakázky přidat znovu (B1)', () => {
    storageService.deleteJobItem('ji-1', USER, makeItem());
    expect(visibleItems()).toHaveLength(0);

    storageService.addCatalogItemToJob('job-1', makeCatalogItem(), 'v1', USER);
    expect(visibleItems()).toHaveLength(1);
    expect(visibleItems()[0]).toMatchObject({ name: 'SkyPanel S60-C', quantityRequested: 1 });
  });

  it('znovu přidaná položka přežije synchronizaci s jiným zařízením (B1)', async () => {
    const deviceB = snapshotDevice();
    storageService.deleteJobItem('ji-1', USER, makeItem());
    let cloud = await pushFromCurrentDevice();

    // device B learns about the deletion
    switchToDevice(deviceB);
    await pullIntoCurrentDevice(cloud);
    const deviceBAfter = snapshotDevice();

    // device A re-adds the same equipment a while later
    switchToDevice(deviceBAfter);
    await new Promise(r => setTimeout(r, 5));
    storageService.addCatalogItemToJob('job-1', makeCatalogItem(), 'v1', USER);
    cloud = await pushFromCurrentDevice();

    // a third device that saw the deletion earlier pulls the new state
    switchToDevice(deviceBAfter);
    await pullIntoCurrentDevice(cloud);
    expect(visibleItems()).toHaveLength(1);
  });

  it('smazanou Ad-Hoc položku jde přidat znovu (B1)', () => {
    const adhoc = storageService.addAdHocItem('job-1', 'Žebřík', 'Grip', 'v1', 1, USER);
    storageService.deleteJobItem(adhoc.id, USER, adhoc);
    storageService.addAdHocItem('job-1', 'Žebřík', 'Grip', 'v1', 2, USER);
    expect(visibleItems().filter(i => i.isAdHoc)).toHaveLength(1);
  });
});

describe('slučování změn mezi zařízeními', () => {
  beforeEach(() => {
    seedLocal({ jobs: [makeJob()], items: [makeItem()] });
  });

  it('přepnutí režimu na zařízení A se projeví na zařízení B (B7)', async () => {
    const deviceB = snapshotDevice();
    await new Promise(r => setTimeout(r, 5));
    storageService.toggleJobMode('job-1', USER);
    const cloud = await pushFromCurrentDevice();

    switchToDevice(deviceB);
    await pullIntoCurrentDevice(cloud);
    expect(storageService.getJobs()[0].mode).toBe('DERIGGING');
  });

  it('novější změna položky z cloudu přepíše lokální', async () => {
    const remote = makeItem({ quantityLoaded: 3, updatedAt: '2026-11-01T11:00:00.000Z' });
    await pullIntoCurrentDevice({ jobs: [makeJob()], jobItems: [remote] });
    expect(visibleItems()[0].quantityLoaded).toBe(3);
  });

  it('novější lokální změna se starším stavem z cloudu nepřepíše', async () => {
    storageService.updateItemQuantity('ji-1', 2, USER, 'LOADING');
    await pullIntoCurrentDevice({ jobs: [makeJob()], jobItems: [makeItem({ quantityLoaded: 0, updatedAt: T0 })] });
    expect(visibleItems()[0].quantityLoaded).toBe(2);
  });

  it('archivovanou zakázku nepřepíše starší ACTIVE z cloudu', async () => {
    storageService.finishJob('job-1', USER);
    await pullIntoCurrentDevice({ jobs: [makeJob({ status: 'ACTIVE', updatedAt: T0 })], jobItems: [] });
    expect(storageService.getJobs()[0].status).toBe('ARCHIVED');
  });

  it('novější obnovení zakázky z jiného zařízení vyhraje nad archivem', async () => {
    storageService.finishJob('job-1', USER);
    const future = new Date(Date.now() + 60_000).toISOString();
    await pullIntoCurrentDevice({ jobs: [makeJob({ status: 'ACTIVE', updatedAt: future })], jobItems: [] });
    expect(storageService.getJobs()[0].status).toBe('ACTIVE');
  });

  it('nová zakázka z jiného zařízení se přidá', async () => {
    await pullIntoCurrentDevice({ jobs: [makeJob({ id: 'job-2', name: 'Druhá' })], jobItems: [] });
    expect(storageService.getJobs().map(j => j.id).sort()).toEqual(['job-1', 'job-2']);
  });
});

describe('robustnost', () => {
  it('slučování duplicit bez sériového čísla nespadne (B8)', () => {
    seedLocal({
      jobs: [makeJob()],
      items: [
        makeItem({ id: 'a', serialNumber: undefined }),
        makeItem({ id: 'b', serialNumber: 'SKY-200' }),
      ],
    });
    expect(() => storageService.getJobItems('job-1')).not.toThrow();
    const [merged] = storageService.getJobItems('job-1');
    expect(merged.quantityRequested).toBe(8);
    expect(merged.serialNumber).toBe('SKY-200');
  });

  it('auditní log se při synchronizaci slučuje a drží nejvýš 300 záznamů', async () => {
    const logs = (prefix, n) => Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`, timestamp: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(), action: 'x',
    }));
    seedLocal({ jobs: [makeJob()], auditLogs: logs('local', 200) });
    await pullIntoCurrentDevice({ auditLogs: logs('remote', 200) });
    const merged = readLocal(KEYS.AUDIT_LOGS);
    expect(merged).toHaveLength(300);
    expect(merged.some(l => l.id.startsWith('local'))).toBe(true);
    expect(merged.some(l => l.id.startsWith('remote'))).toBe(true);
  });

  it('cloudový dokument s ukázkovými daty je hluboko pod limitem 1 MB', async () => {
    seedLocal({
      jobs: INITIAL_JOBS, items: INITIAL_JOB_ITEMS, catalog: INITIAL_CATALOG,
      consumables: INITIAL_CONSUMABLES, auditLogs: INITIAL_AUDIT_LOGS,
    });
    const payload = await pushFromCurrentDevice();
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    expect(bytes).toBeLessThan(900 * 1024);
  });
});
