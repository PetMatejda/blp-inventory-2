import React, { useState, useEffect } from 'react';
import { Plus, Truck, Archive, ArchiveRestore, Trash2, ChevronRight } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { DeadlineBadge } from './VehicleBadges';
import { plural } from '../../domain/labels';
import { vehicleDeadlines, vehicleAlerts, todayIso, formatDue, parseDueInput, dueDate } from '../../domain/vehicles';

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

/** Auta (bottom bar): the company fleet with STK and vignette deadlines. */
export const VehiclesScreen = () => {
  const { vehicles, navFocus, setNavFocus } = useInventory();
  const [editing, setEditing] = useState(null); // null | 'NEW' | vehicle

  // Opened from an alert: show that vehicle right away.
  useEffect(() => {
    if (navFocus?.type !== 'vehicle') return;
    const v = vehicles.find((x) => x.id === navFocus.id);
    if (v) setEditing(v);
    setNavFocus(null);
  }, [navFocus, vehicles, setNavFocus]);

  const today = todayIso();
  const active = vehicles.filter((v) => v.active !== false);
  const retired = vehicles.filter((v) => v.active === false);
  // Most urgent deadline first, so the cars that need attention are on top.
  const soonest = (v) => Math.min(...['stkDue', 'vignetteDue'].map((f) => (dueDate(v[f]) ? Date.parse(dueDate(v[f])) : Infinity)));
  const sorted = [...active].sort((a, b) => soonest(a) - soonest(b));
  const needAttention = active.filter((v) => vehicleAlerts(v, today).length).length;
  const editingVehicle = editing && editing !== 'NEW' ? vehicles.find((v) => v.id === editing.id) || editing : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-on-surface">Auta</h1>
          <p className="text-sm text-on-surface-variant">
            {active.length} v provozu{needAttention ? ` · ${needAttention} ${plural(needAttention, 'potřebuje', 'potřebují', 'potřebuje')} pozornost` : ' · vše v pořádku'}
          </p>
        </div>
        <button type="button" onClick={() => setEditing('NEW')}
          className="h-12 px-4 rounded-xl bg-primary text-on-primary-container font-bold flex items-center gap-2 shrink-0 active:scale-95">
          <Plus className="w-5 h-5" /> Přidat
        </button>
      </div>
      <p className="text-xs text-on-surface-variant -mt-2">STK hlídána 60 dní, dálniční známka 30 dní předem.</p>

      {active.length === 0 && (
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center gap-3">
          <Truck className="w-10 h-10 text-outline/50" />
          <p>Zatím žádná auta.</p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {sorted.map((v) => <VehicleRow key={v.id} vehicle={v} today={today} onOpen={() => setEditing(v)} />)}
      </ul>
      {retired.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-on-surface-variant py-2">Vyřazená vozidla ({retired.length})</summary>
          <ul className="flex flex-col gap-2 mt-2">
            {retired.map((v) => <VehicleRow key={v.id} vehicle={v} today={today} onOpen={() => setEditing(v)} />)}
          </ul>
        </details>
      )}

      {editing && (
        <Sheet title={editingVehicle ? `${editingVehicle.name} ${editingVehicle.plate}` : 'Nový vůz'} subtitle="Auta" onClose={() => setEditing(null)}>
          <VehicleForm key={editingVehicle?.id || 'new'} vehicle={editingVehicle} onDone={() => setEditing(null)} />
        </Sheet>
      )}
    </div>
  );
};
