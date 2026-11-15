// Shared form pieces for sheets: 16px text (no zoom on focus), 48px fields,
// readable labels, 56px action buttons.
import React from 'react';

export const inputCls = 'w-full h-12 px-3 bg-surface-container border border-outline-variant rounded-xl text-base text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export const Field = ({ label, required = false, icon: Icon, children }) => (
  <label className="block">
    <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant mb-1.5">
      {Icon && <Icon className="w-4 h-4" />}
      {label}{required && <span aria-hidden="true"> *</span>}
    </span>
    {children}
  </label>
);

const TONES = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  danger: 'bg-error text-on-error',
};

/** Cancel + main action, meant for the sticky footer of a Sheet. */
export const SheetButtons = ({ onCancel, cancelLabel = 'Zrušit', submitLabel, icon: Icon, form, onSubmit, disabled = false, tone = 'primary' }) => (
  <div className="grid grid-cols-[1fr_1.6fr] gap-3">
    <button type="button" onClick={onCancel} className="h-14 rounded-2xl border border-outline-variant bg-surface-container text-on-surface text-base font-semibold active:scale-[0.98]">
      {cancelLabel}
    </button>
    <button
      type={form ? 'submit' : 'button'}
      form={form}
      onClick={onSubmit}
      disabled={disabled}
      className={`h-14 rounded-2xl text-base font-bold shadow flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 ${TONES[tone]}`}
    >
      {Icon && <Icon className="w-5 h-5 shrink-0" />} {submitLabel}
    </button>
  </div>
);
