import React from 'react';
import { Truck, Warehouse, PackageCheck, ShoppingCart, ChevronRight } from 'lucide-react';
import { ALERT_GROUPS } from '../../domain/alerts';

export const GROUP_ICON = { vehicles: Truck, stock: Warehouse, jobs: PackageCheck, consumables: ShoppingCart };

export const SEVERITY = {
  critical: {
    label: 'Hned řešit', stripe: 'bg-error', icon: 'text-error bg-error-container/40 border-error/40',
    chip: 'bg-error text-on-error border-error',
  },
  warning: {
    label: 'Brzy', stripe: 'bg-amber-500', icon: 'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/40',
    chip: 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/50',
  },
  info: {
    label: 'Pro informaci', stripe: 'bg-sky-500', icon: 'text-sky-700 dark:text-sky-300 bg-sky-500/15 border-sky-500/40',
    chip: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/40',
  },
};

/** One alert: coloured stripe by severity, icon by area, tap opens the place to act. */
export const AlertCard = ({ alert, onOpen, compact = false }) => {
  const sev = SEVERITY[alert.severity];
  const Icon = GROUP_ICON[alert.group] || Warehouse;
  return (
    <button type="button" onClick={() => onOpen(alert.target)}
      className="w-full text-left bg-card-bg border border-outline-variant rounded-2xl overflow-hidden flex items-stretch active:scale-[0.99] hover:bg-surface-container transition-colors">
      <span className={`w-1.5 shrink-0 ${sev.stripe}`} aria-hidden="true" />
      <span className={`flex items-start gap-3 flex-1 min-w-0 ${compact ? 'p-2.5' : 'p-3'}`}>
        <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${sev.icon}`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="font-bold text-on-surface leading-snug truncate">{alert.title}</span>
            {!compact && <span className="text-xs font-semibold uppercase tracking-wide text-outline shrink-0">{ALERT_GROUPS[alert.group]}</span>}
          </span>
          <span className={`block text-sm text-on-surface-variant ${compact ? 'truncate' : 'break-words'}`}>{alert.detail}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-outline shrink-0 self-center" />
      </span>
    </button>
  );
};
