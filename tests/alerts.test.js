import { describe, it, expect } from 'vitest';
import { buildAlerts, alertCounts } from '../src/domain/alerts.js';

const TODAY = '2026-11-15';

describe('upozornění', () => {
  const data = {
    vehicles: [
      { id: 'a', name: 'Sprinter', plate: '9AN 8877', stkDue: '2026-11-10', vignetteDue: '2027-04-21' },
      { id: 'b', name: 'Viano', plate: '6P7 1711', stkDue: '2027-09', vignetteDue: '2026-12-01' },
      { id: 'c', name: 'Vyřazený', plate: 'X', stkDue: '2020-01', active: false },
    ],
    catalog: [{ id: 'k1', name: 'Gaffair 4 kW' }, { id: 'k2', name: 'Ballast 600 W' }],
    stockLevels: [{ id: 'k1', catalogId: 'k1', inStock: 3, missing: 1, inService: 0 }, { id: 'k2', catalogId: 'k2', inStock: 5, inService: 2 }],
    stockUnits: [{ id: 'u1', catalogId: 'k1', code: '1001', status: 'MISSING' }, { id: 'u2', catalogId: 'k2', code: '240', status: 'IN_SERVICE' }],
    jobs: [{ id: 'j1', name: 'Granilla', status: 'ACTIVE' }, { id: 'j2', name: 'Stará', status: 'ARCHIVED' }],
    jobItems: [{ id: 'i1', jobId: 'j1', name: 'Tuba 5x2', status: 'DAMAGED' }, { id: 'i2', jobId: 'j2', name: 'X', status: 'DAMAGED' }],
    consumables: [{ id: 'c1', name: 'Gaffa černá', state: 2 }, { id: 'c2', name: 'Baterie AA', state: 1 }],
    stocktakes: [{ id: 's1', status: 'OPEN', startedBy: 'Petr (ADMIN)' }],
  };

  it('collects alerts from vehicles, stock, jobs, consumables and stocktakes, most urgent first', () => {
    const alerts = buildAlerts(data, TODAY);
    expect(alerts.map((a) => a.id)).toEqual([
      'vehicle-a-stk', 'missing-k1',
      'vehicle-b-vignette', 'service-k2', 'damaged-j1', 'consumables-out',
      'stocktake-s1', 'consumables-half',
    ]);
    expect(alerts[0]).toMatchObject({ severity: 'critical', detail: 'STK propadlá před 5 dny', target: { tab: 'vehicles', vehicleId: 'a' } });
    expect(alerts[1].detail).toBe('Chybí po zakázce: 1 ks (1001)');
    expect(alerts.find((a) => a.id === 'service-k2')).toMatchObject({ detail: 'V servisu: 2 ks (240)', target: { warehouseTab: 'stock', catalogId: 'k2' } });
    expect(alerts.find((a) => a.id === 'damaged-j1').detail).toBe('1 položka se závadou: Tuba 5x2');
    expect(alerts.find((a) => a.id === 'stocktake-s1').detail).toBe('Zahájil(a) Petr');
    expect(alertCounts(alerts)).toEqual({ critical: 2, warning: 4, info: 2, urgent: 6, total: 8 });
  });

  it('nothing to report', () => {
    expect(buildAlerts({}, TODAY)).toEqual([]);
  });
});
