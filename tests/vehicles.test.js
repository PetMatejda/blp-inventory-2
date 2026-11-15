import { describe, it, expect } from 'vitest';
import {
  dueDate, daysBetween, formatDue, deadlineStatus, vehicleAlerts, fleetAlerts,
  parseDueInput, validateVehicle, normalizePlate, vehicleLabel, worstLevel,
} from '../src/domain/vehicles.js';

const TODAY = '2026-11-15';

describe('vehicle deadlines', () => {
  it('month-only STK counts until the end of the month', () => {
    expect(dueDate('2027-01')).toBe('2027-01-31');
    expect(dueDate('2027-02')).toBe('2027-02-28');
    expect(dueDate('2027-04-21')).toBe('2027-04-21');
    expect(dueDate('')).toBe('');
    expect(dueDate('nonsense')).toBe('');
  });

  it('counts days and formats dates', () => {
    expect(daysBetween(TODAY, '2026-11-16')).toBe(1);
    expect(daysBetween(TODAY, '2026-11-10')).toBe(-5);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across DST change
    expect(formatDue('2027-01')).toBe('1/2027');
    expect(formatDue('2027-04-21')).toBe('21. 4. 2027');
  });

  it('STK: ok over 60 days, warn within 60, danger within 7, expired after', () => {
    expect(deadlineStatus('stk', '2027-03', TODAY).level).toBe('ok');
    expect(deadlineStatus('stk', '2027-01', TODAY)).toMatchObject({ level: 'ok', days: 77, text: 'STK do 1/2027' });
    expect(deadlineStatus('stk', '2027-01', '2026-12-05')).toMatchObject({ level: 'warn', days: 57 });
    expect(deadlineStatus('stk', '2026-12-20', TODAY)).toMatchObject({ level: 'warn', days: 35, text: 'STK za 35 dní' });
    expect(deadlineStatus('stk', '2026-11-20', TODAY)).toMatchObject({ level: 'danger', days: 5, text: 'STK za 5 dní' });
    expect(deadlineStatus('stk', '2026-11-15', TODAY).text).toBe('STK dnes');
    expect(deadlineStatus('stk', '2026-11-13', TODAY)).toMatchObject({ level: 'expired', text: 'STK propadlá před 2 dny' });
    expect(deadlineStatus('stk', '', TODAY).level).toBe('none');
  });

  it('vignette warns only 30 days ahead', () => {
    expect(deadlineStatus('vignette', '2026-12-20', TODAY).level).toBe('ok');
    expect(deadlineStatus('vignette', '2026-12-10', TODAY)).toMatchObject({ level: 'warn', text: 'Známka za 25 dní' });
  });

  it('a deadline that runs out during a job is a warning', () => {
    const s = deadlineStatus('vignette', '2027-03-23', '2027-01-10', { until: '2027-03-25' });
    expect(s).toMatchObject({ level: 'warn', duringJob: true });
    expect(s.text).toBe('Známka skončí během zakázky (23. 3. 2027)');
    expect(deadlineStatus('vignette', '2027-03-23', '2027-01-10', { until: '2027-03-20' }).level).toBe('ok');
  });

  it('alerts per vehicle and for the fleet, most urgent first, retired skipped', () => {
    const a = { id: 'a', name: 'Sprinter', stkDue: '2027-01', vignetteDue: '2027-04-21' };
    const b = { id: 'b', name: 'Viano', stkDue: '2026-11-20', vignetteDue: '2027-04-28' };
    const c = { id: 'c', name: 'Starý', stkDue: '2020-01', active: false };
    const d = { id: 'd', name: 'T180', stkDue: '2030-09', vignetteDue: '2027-09-06' };
    expect(vehicleAlerts(d, TODAY)).toEqual([]);
    expect(vehicleAlerts(b, TODAY).map((s) => s.kind)).toEqual(['stk']);
    expect(fleetAlerts([a, b, c, d], TODAY).map((x) => x.vehicle.id)).toEqual(['b']);
    expect(fleetAlerts([a, b, c, d], '2026-12-05').map((x) => x.vehicle.id)).toEqual(['b', 'a']);
    expect(worstLevel(vehicleAlerts(b, TODAY))).toBe('danger');
  });
});

describe('vehicle form', () => {
  it('parses deadlines as typed', () => {
    expect(parseDueInput('1/2027')).toBe('2027-01');
    expect(parseDueInput('12 / 2028')).toBe('2028-12');
    expect(parseDueInput('2027-03')).toBe('2027-03');
    expect(parseDueInput('21.4.27')).toBe('2027-04-21');
    expect(parseDueInput('6. 9. 2027')).toBe('2027-09-06');
    expect(parseDueInput('2027-04-21')).toBe('2027-04-21');
    expect(parseDueInput('')).toBe('');
    expect(parseDueInput('31.2.2027')).toBeNull();
    expect(parseDueInput('13/2027')).toBeNull();
    expect(parseDueInput('brzy')).toBeNull();
  });

  it('validates plate and name, plates unique', () => {
    const fleet = [{ id: 'a', plate: '9AN 8877', name: 'Sprinter' }];
    expect(normalizePlate(' 9an  8877 ')).toBe('9AN 8877');
    expect(validateVehicle({ plate: '', name: 'X' })).toBe('Zadejte SPZ.');
    expect(validateVehicle({ plate: '1AB 1234', name: ' ' })).toBe('Zadejte název vozu.');
    expect(validateVehicle({ plate: '9an 8877', name: 'X' }, fleet)).toMatch(/už existuje/);
    expect(validateVehicle({ plate: '9AN 8877', name: 'Sprinter' }, fleet, 'a')).toBe('');
    expect(vehicleLabel(fleet[0])).toBe('Sprinter (9AN 8877)');
  });
});

import { createVehicleActions } from '../src/services/vehicleActions.js';
import { createMemoryRepo } from './memoryRepo.js';

describe('vehicle actions', () => {
  const setup = (seed = {}) => {
    const mem = createMemoryRepo(seed);
    return { mem, actions: createVehicleActions({ repo: mem.repo, getState: mem.state, getActor: () => 'Tester (ADMIN)' }) };
  };

  it('adds a vehicle with a normalized plate and an audit entry', () => {
    const { mem, actions } = setup();
    const { vehicle } = actions.createVehicle({ name: 'Sprinter černý', plate: '9an 8877', stkDue: '2027-01' });
    expect(mem.all('vehicles')[0]).toMatchObject({ id: vehicle.id, plate: '9AN 8877', active: true, order: 1 });
    expect(mem.all('auditLogs').at(-1).detail).toBe('Nové vozidlo: Sprinter černý 9AN 8877');
    expect(actions.createVehicle({ name: 'Jiný', plate: '9AN8877 ' }).error).toBeUndefined();
    expect(actions.createVehicle({ name: 'Jiný', plate: '9an 8877' }).error).toMatch(/už existuje/);
  });

  it('logs changed deadlines', () => {
    const { mem, actions } = setup({ vehicles: [{ id: 'v', name: 'Viano', plate: '6P7 1711', stkDue: '2027-09', vignetteDue: '2027-04-28' }] });
    actions.updateVehicle('v', { stkDue: '2029-09' });
    expect(mem.all('vehicles')[0].stkDue).toBe('2029-09');
    expect(mem.all('auditLogs').at(-1).detail).toBe('Viano 6P7 1711: STK: 9/2027 → 9/2029');
  });

  it('a vehicle on a job can only be retired, not deleted', () => {
    const { mem, actions } = setup({
      vehicles: [{ id: 'v', name: 'Jogger', plate: '5ST 3525' }, { id: 'w', name: 'T180', plate: '1AR T457' }],
      jobs: [{ id: 'j', name: 'Job', vehicleIds: ['v'] }],
    });
    expect(actions.deleteVehicle('v').error).toMatch(/vyřadit/);
    actions.setVehicleActive('v', false);
    expect(mem.all('vehicles').find((x) => x.id === 'v').active).toBe(false);
    actions.deleteVehicle('w');
    expect(mem.all('vehicles').map((x) => x.id)).toEqual(['v']);
  });
});
