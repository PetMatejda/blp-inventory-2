// One attendance record: what, when, optional note. Used for new entries and corrections.
import React, { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { Field, inputCls, SheetButtons } from '../common/FormField';
import { WORK_TYPES, ABSENCE_TYPES, typeOf, hoursOf, fmtHours } from '../../domain/attendance';
import { titlesOn } from '../../domain/productionCalendar';
import { fmtDayLong } from './dates';

/** entry: { id?, date, type, from, to, note } */
export const EntrySheet = ({ entry, onClose }) => {
  const { saveAttendance, deleteAttendance, productionCalendar, jobs } = useInventory();
  const { toast } = useDialogs();
  const [form, setForm] = useState(entry);
  const [error, setError] = useState('');
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(''); };

  const isWork = !!typeOf(form.type)?.work;
  const suggestions = isWork && form.date ? titlesOn(productionCalendar, jobs, form.date) : [];

  const submit = (e) => {
    e.preventDefault();
    const r = saveAttendance(form);
    if (r.error) { setError(r.error); return; }
    toast({ text: `Uloženo: ${typeOf(r.record.type).label}${isWork ? ` ${r.record.from}–${r.record.to}` : ''}` });
    onClose();
  };

  const remove = () => {
    const r = deleteAttendance(form.id);
    if (r.error) { setError(r.error); return; }
    const { id, uid, userName, email, createdAt, updatedAt, ...old } = r.record;
    toast({ text: 'Záznam smazán', actionLabel: 'Vrátit', onAction: () => saveAttendance(old) });
    onClose();
  };

  const chip = (t, tall) => (
    <button
      key={t.id}
      type="button"
      role="radio"
      aria-checked={form.type === t.id}
      onClick={() => set({ type: t.id })}
      className={`${tall ? 'h-14 text-base' : 'h-12 text-sm'} rounded-xl border font-bold flex items-center justify-center gap-2 ${
        form.type === t.id ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container text-on-surface border-outline-variant'
      }`}
    >
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true" />
      {t.label}
    </button>
  );

  return (
    <Sheet
      title={form.id ? 'Opravit záznam' : 'Zapsat docházku'}
      subtitle={form.date ? fmtDayLong(form.date) : ''}
      onClose={onClose}
      dismissOnBackdrop={false}
      footer={<SheetButtons onCancel={onClose} form="attendance-form" submitLabel="Uložit" icon={Check} />}
    >
      <form id="attendance-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Den">
          <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required className={inputCls} />
        </Field>

        <div>
          <span className="block text-sm font-semibold text-on-surface-variant mb-1.5">Co jsem dělal</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Typ práce">
            {WORK_TYPES.map((t) => chip(t, true))}
          </div>
          <span className="block text-sm font-semibold text-on-surface-variant mt-3 mb-1.5">Nebo nepřítomnost (celý den)</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Nepřítomnost">
            {ABSENCE_TYPES.map((t) => chip(t, false))}
          </div>
        </div>

        {isWork && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Od">
                <input type="time" value={form.from} onChange={(e) => set({ from: e.target.value })} required className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Do">
                <input type="time" value={form.to} onChange={(e) => set({ to: e.target.value })} required className={`${inputCls} font-mono`} />
              </Field>
            </div>
            {hoursOf(form) > 0 && <p className="text-sm text-on-surface-variant mt-1.5">Celkem {fmtHours(hoursOf(form))}</p>}
          </div>
        )}

        <Field label={isWork ? 'Zakázka / místo (nepovinné)' : 'Poznámka (nepovinné)'}>
          <input
            type="text"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder={isWork ? 'Např. Letňany, Stage D' : ''}
            maxLength={200}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            className={inputCls}
          />
        </Field>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 -mt-2">
            {suggestions.slice(0, 6).map((title) => (
              <button key={title} type="button" onClick={() => set({ note: title })}
                className="min-h-[44px] px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-container text-sm text-on-surface text-left">
                {title}
              </button>
            ))}
          </div>
        )}

        {error && <p role="alert" className="text-sm font-semibold text-error bg-error-container/20 border border-error/30 rounded-xl p-3">{error}</p>}

        {form.id && (
          <button type="button" onClick={remove} className="self-start h-11 px-3 rounded-xl border border-error/40 text-error text-sm font-semibold flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Smazat záznam
          </button>
        )}
      </form>
    </Sheet>
  );
};
