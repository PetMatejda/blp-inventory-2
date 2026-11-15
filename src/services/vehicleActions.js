// Company vehicles (collection `vehicles`): add, edit, retire, delete.
// Every change leaves an audit entry. Rules for deadlines: src/domain/vehicles.js.
import { normalizePlate, validateVehicle, formatDue, DEADLINES } from '../domain/vehicles.js';

const FIELDS = ['name', 'model', 'kind', 'plate', 'color', 'transmission', 'fuel', 'stkDue', 'vignetteDue', 'note'];

export function createVehicleActions({ repo, getState, getActor }) {
  const now = () => new Date().toISOString();
  const vehicles = () => getState().vehicles || [];
  const auditOp = (action, detail, type = 'update') => {
    const id = repo.newId('auditLogs');
    return { type: 'set', col: 'auditLogs', id, data: { id, timestamp: now(), user: getActor(), jobId: '', action, detail, type } };
  };
  const clean = (data) => {
    const out = {};
    for (const k of FIELDS) if (k in data) out[k] = String(data[k] ?? '').trim();
    if ('plate' in out) out.plate = normalizePlate(out.plate);
    return out;
  };
  const label = (v) => `${v.name} ${v.plate}`;

  return {
    /** Returns { error } or { vehicle }. */
    createVehicle(data) {
      const error = validateVehicle(data, vehicles());
      if (error) return { error };
      const id = repo.newId('vehicles');
      const order = Math.max(0, ...vehicles().map((v) => v.order || 0)) + 1;
      const vehicle = { id, ...clean(data), active: true, order, createdAt: now(), updatedAt: now(), updatedBy: getActor() };
      repo.commit([
        { type: 'set', col: 'vehicles', id, data: vehicle },
        auditOp('Vozidla – přidání', `Nové vozidlo: ${label(vehicle)}`, 'add'),
      ]);
      return { vehicle };
    },

    /** Returns { error } or { vehicle }. Changed deadlines are spelled out in the audit. */
    updateVehicle(id, data) {
      const old = vehicles().find((v) => v.id === id);
      if (!old) return { error: 'Vozidlo neexistuje.' };
      const next = { ...old, ...clean(data) };
      const error = validateVehicle(next, vehicles(), id);
      if (error) return { error };
      const patch = { ...clean(data), updatedAt: now(), updatedBy: getActor() };
      const changes = Object.values(DEADLINES)
        .filter((d) => (old[d.field] || '') !== (next[d.field] || ''))
        .map((d) => `${d.label}: ${formatDue(old[d.field]) || '—'} → ${formatDue(next[d.field]) || '—'}`);
      repo.commit([
        { type: 'update', col: 'vehicles', id, data: patch },
        auditOp('Vozidla – úprava', `${label(next)}${changes.length ? `: ${changes.join(', ')}` : ' – upraveny údaje'}`),
      ]);
      return { vehicle: next };
    },

    /** Retired vehicles are hidden from job pickers but stay on old jobs. */
    setVehicleActive(id, active) {
      const v = vehicles().find((x) => x.id === id);
      if (!v) return null;
      repo.commit([
        { type: 'update', col: 'vehicles', id, data: { active, updatedAt: now(), updatedBy: getActor() } },
        auditOp(active ? 'Vozidla – vráceno do provozu' : 'Vozidla – vyřazení', label(v)),
      ]);
      return { ...v, active };
    },

    /** Only a vehicle no job uses can be deleted (otherwise retire it). */
    deleteVehicle(id) {
      const v = vehicles().find((x) => x.id === id);
      if (!v) return { error: 'Vozidlo neexistuje.' };
      if ((getState().jobs || []).some((j) => j.vehicleIds?.includes(id))) {
        return { error: 'Vozidlo je na zakázce — můžete ho jen vyřadit.' };
      }
      repo.commit([
        { type: 'delete', col: 'vehicles', id },
        auditOp('Vozidla – smazání', `Smazáno vozidlo: ${label(v)}`),
      ]);
      return { vehicle: v };
    },
  };
}
