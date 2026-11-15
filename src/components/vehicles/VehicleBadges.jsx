import React from 'react';
import { AlertTriangle, CalendarCheck } from 'lucide-react';

const STYLE = {
  ok: 'bg-surface-container text-on-surface-variant border-outline-variant',
  none: 'bg-surface-container text-outline border-outline-variant border-dashed',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50',
  danger: 'bg-error-container/40 text-error border-error/60',
  expired: 'bg-error text-white border-error',
};

/** One deadline (STK / known) as a coloured pill. */
export const DeadlineBadge = ({ status }) => {
  const alert = ['warn', 'danger', 'expired'].includes(status.level);
  const Icon = alert ? AlertTriangle : CalendarCheck;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${STYLE[status.level]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" /> {status.text}
    </span>
  );
};
