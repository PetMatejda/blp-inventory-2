// Fields shared by the New / Edit / Duplicate job sheets.
import React from 'react';
import { Calendar } from 'lucide-react';
import { Field, inputCls } from '../common/FormField';
import { VehiclePicker } from '../vehicles/VehiclePicker';

export const todayIso = () => new Date().toISOString().split('T')[0];

export const emptyJobForm = () => ({
  name: '', client: '', blpResponsible: '', gaffer: '',
  riggingDate: todayIso(), deriggingDate: todayIso(), vehicleIds: [],
});

/** Job form values → the shape the job actions expect. */
export const toJobData = (f, { withVehicles = true } = {}) => ({
  name: f.name,
  client: f.client,
  blpResponsible: f.blpResponsible,
  assignedGaffer: f.gaffer,
  riggingDate: f.riggingDate,
  deriggingDate: f.deriggingDate,
  ...(withVehicles ? { vehicleIds: f.vehicleIds } : {}),
});

export const JobFormFields = ({ form, set, nameLabel = 'Název zakázky', showVehicles = true, autoFocusName = false }) => {
  // The return date can never be before the rigging date.
  const setRigging = (riggingDate) => set({
    riggingDate,
    ...(form.deriggingDate && riggingDate > form.deriggingDate ? { deriggingDate: riggingDate } : {}),
  });

  return (
    <>
      <Field label={nameLabel} required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Např. Reklama Hyundai – den 1"
          required
          autoFocus={autoFocusName}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="next"
          className={inputCls}
        />
      </Field>

      <Field label="Klient / produkce">
        <input
          type="text"
          value={form.client}
          onChange={(e) => set({ client: e.target.value })}
          placeholder="Např. Stillking Films"
          autoComplete="organization"
          autoCapitalize="words"
          enterKeyHint="next"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Zodpovědný za BLP">
          <input
            type="text"
            value={form.blpResponsible}
            onChange={(e) => set({ blpResponsible: e.target.value })}
            placeholder="Např. Marek Radolf"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            className={inputCls}
          />
        </Field>
        <Field label="Gaffer (štáb)">
          <input
            type="text"
            value={form.gaffer}
            onChange={(e) => set({ gaffer: e.target.value })}
            placeholder="Např. Petr M."
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rigging" icon={Calendar}>
          <input type="date" value={form.riggingDate} onChange={(e) => setRigging(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Derigging" icon={Calendar}>
          <input type="date" value={form.deriggingDate} min={form.riggingDate || undefined} onChange={(e) => set({ deriggingDate: e.target.value })} required className={inputCls} />
        </Field>
      </div>

      {showVehicles && <VehiclePicker value={form.vehicleIds} onChange={(vehicleIds) => set({ vehicleIds })} until={form.deriggingDate} />}
    </>
  );
};
