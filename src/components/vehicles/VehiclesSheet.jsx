import React, { useState } from 'react';
import { Plus, Truck, Archive, ArchiveRestore, Trash2, ChevronRight } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { DeadlineBadge } from './VehicleBadges';
import { vehicleDeadlines, todayIso, formatDue, parseDueInput, dueDate } from '../../domain/vehicles';

const EMPTY = { name: '', plate: '', model: '', color: '', transmission: '', fuel: '', stkDue: '', vignetteDue: '', note: '' };
const input = 'w-full h-12 px-3 bg-surface-container border border-outline-variant rounded-xl text-base text-on-surface focus:outline-none focus:border-primary';

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-bold text-outline mb-1 uppercase">{label}</span>
    {children}
    {hint && <span className="block text-xs text-on-surface-variant mt-1">{hint}</span>}
  </label>
);

/** Add / edit one vehicle. */
const VehicleForm = ({ vehicle, onDone }) => {
  const { createVehicle, updateVehicle, setVehicleActive, deleteVehicle } = useInventory();
  const { confirm, toast } = useDialogs();
  const isNew = !vehicle;
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(vehicle || {}), stkDue: formatDue(vehicle?.stkDue) }));
  const [error, setError] = useState('');
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(''); };

  const save = (e) => {
    e.preventDefault();
    const stkDue = parseDueInput(form.stkDue);
    if (stkDue === null) { setError('STK zadejte jako měsíc/rok (1/2027) nebo přesné datum (18. 1. 2027).'); return; }
    const data = { ...form, stkDue };
    const res = isNew ? createVehicle(data) : updateVehicle(vehicle.id, data);
    if (res.error) { setError(res.error); return; }
    toast({ text: isNew ? `Přidáno: ${res.vehicle.name}` : `Uloženo: ${res.vehicle.name}` });
    onDone();
  };

  const retire = async () => {
    const active = vehicle.active === false;
    if (!active && !(await confirm({
      title: `Vyřadit ${vehicle.name}?`,
      message: 'Vůz zmizí z výběru u zakázek a nebude hlídaný. Na starých zakázkách zůstane. Kdykoli ho můžete vrátit.',
      confirmLabel: 'Vyřadit',
    }))) return;
    setVehicleActive(vehicle.id, active);
    onDone();
  };

  const remove = async () => {
    if (!(await confirm({ title: `Smazat ${vehicle.name}?`, message: 'Smazání nejde vrátit.', confirmLabel: 'Smazat', danger: true }))) return;
    const res = deleteVehicle(vehicle.id);
    if (res.error) { setError(res.error); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Název *"><input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Sprinter černý" /></Field>
        <Field label="SPZ *"><input className={`${input} font-mono uppercase`} value={form.plate} onChange={(e) => set({ plate: e.target.value })} placeholder="9AN 8877" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Model"><input className={input} value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="Mercedes Sprinter" /></Field>
        <Field label="Barva"><input className={input} value={form.color} onChange={(e) => set({ color: e.target.value })} placeholder="černá" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Převodovka">
          <select className={input} value={form.transmission} onChange={(e) => set({ transmission: e.target.value })}>
            <option value="">—</option><option value="manuál">manuál</option><option value="automat">automat</option>
          </select>
        </Field>
        <Field label="Palivo"><input className={input} value={form.fuel} onChange={(e) => set({ fuel: e.target.value })} placeholder="nafta" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="STK do" hint="1/2027 nebo 18. 1. 2027">
          <input className={`${input} font-mono`} value={form.stkDue} onChange={(e) => set({ stkDue: e.target.value })} placeholder="1/2027" inputMode="numeric" />
        </Field>
        <Field label="Dálniční známka do">
          <input type="date" className={`${input} font-mono`} value={form.vignetteDue} onChange={(e) => set({ vignetteDue: e.target.value })} />
        </Field>
      </div>
      <Field label="Poznámka"><input className={input} value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>

      {error && <p role="alert" className="text-sm font-semibold text-error">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 h-12 rounded-xl border border-outline-variant bg-surface-container font-semibold">Zpět</button>
        <button type="submit" className="flex-1 h-12 rounded-xl bg-primary text-on-primary-container font-bold">{isNew ? 'Přidat vůz' : 'Uložit'}</button>
      </div>
      {!isNew && (
        <div className="flex gap-2">
          <button type="button" onClick={retire} className="flex-1 h-11 rounded-xl border border-outline-variant bg-card-bg text-sm font-semibold flex items-center justify-center gap-1.5">
            {vehicle.active === false ? <><ArchiveRestore className="w-4 h-4" /> Vrátit do provozu</> : <><Archive className="w-4 h-4" /> Vyřadit</>}
          </button>
          <button type="button" onClick={remove} className="flex-1 h-11 rounded-xl border border-error/40 bg-card-bg text-error text-sm font-semibold flex items-center justify-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Smazat
          </button>
        </div>
      )}
    </form>
  );
};

const VehicleRow = ({ vehicle, today, onOpen }) => {
  const details = [vehicle.model, vehicle.color, vehicle.transmission, vehicle.fuel].filter(Boolean).join(' · ');
  return (
    <li>
      <button type="button" onClick={onOpen}
        className={`w-full text-left bg-card-bg border border-outline-variant rounded-2xl p-3 flex items-start gap-3 active:scale-[0.99] ${vehicle.active === false ? 'opacity-60' : ''}`}>
        <Truck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-on-surface">{vehicle.name}</span>
            <span className="font-mono text-sm text-on-surface-variant">{vehicle.plate}</span>
          </span>
          {details && <span className="text-sm text-on-surface-variant">{details}</span>}
          {vehicle.active === false
            ? <span className="text-xs font-semibold text-outline">Vyřazeno</span>
            : <span className="flex flex-wrap gap-1.5">{vehicleDeadlines(vehicle, today).map((s) => <DeadlineBadge key={s.kind} status={s} />)}</span>}
        </span>
        <ChevronRight className="w-5 h-5 text-outline shrink-0 mt-0.5" />
      </button>
    </li>
  );
};

/** Settings › Vozidla: the company fleet with STK and vignette deadlines. */
export const VehiclesSheet = () => {
  const { isVehiclesOpen, setIsVehiclesOpen, vehicles } = useInventory();
  const [editing, setEditing] = useState(null); // null = list | 'NEW' | vehicle
  if (!isVehiclesOpen) return null;

  const today = todayIso();
  const close = () => { setEditing(null); setIsVehiclesOpen(false); };
  const active = vehicles.filter((v) => v.active !== false);
  const retired = vehicles.filter((v) => v.active === false);
  // Most urgent deadline first, so the cars that need attention are on top.
  const soonest = (v) => Math.min(...['stkDue', 'vignetteDue'].map((f) => (dueDate(v[f]) ? Date.parse(dueDate(v[f])) : Infinity)));
  const sorted = [...active].sort((a, b) => soonest(a) - soonest(b));

  if (editing) {
    const vehicle = editing === 'NEW' ? null : vehicles.find((v) => v.id === editing.id) || editing;
    return (
      <Sheet title={vehicle ? `${vehicle.name} ${vehicle.plate}` : 'Nový vůz'} subtitle="Vozidla" onClose={close}>
        <VehicleForm key={vehicle?.id || 'new'} vehicle={vehicle} onDone={() => setEditing(null)} />
      </Sheet>
    );
  }

  return (
    <Sheet title="Vozidla" subtitle={`${active.length} v provozu · STK hlídána 60 dní, známka 30 dní předem`} onClose={close}>
      <button type="button" onClick={() => setEditing('NEW')}
        className="h-12 rounded-xl bg-primary text-on-primary-container font-bold flex items-center justify-center gap-2">
        <Plus className="w-5 h-5" /> Přidat vůz
      </button>
      {active.length === 0 && <p className="text-sm text-on-surface-variant text-center">Zatím žádná auta.</p>}
      <ul className="flex flex-col gap-2">
        {sorted.map((v) => <VehicleRow key={v.id} vehicle={v} today={today} onOpen={() => setEditing(v)} />)}
      </ul>
      {retired.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-on-surface-variant">Vyřazená vozidla ({retired.length})</summary>
          <ul className="flex flex-col gap-2 mt-2">
            {retired.map((v) => <VehicleRow key={v.id} vehicle={v} today={today} onOpen={() => setEditing(v)} />)}
          </ul>
        </details>
      )}
    </Sheet>
  );
};
