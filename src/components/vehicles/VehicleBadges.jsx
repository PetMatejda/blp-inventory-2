import React from 'react';
import { AlertTriangle, CalendarCheck, Truck, Bus, Car } from 'lucide-react';
import { vehicleKind, VEHICLE_KINDS } from '../../domain/vehicles';

const STYLE = {
  ok: 'bg-surface-container text-on-surface-variant border-outline-variant',
  none: 'bg-surface-container text-outline border-outline-variant border-dashed',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50',
  danger: 'bg-error-container/40 text-error border-error/60',
  expired: 'bg-error text-on-error border-error',
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

const KIND_ICON = { truck: Truck, van: Bus, car: Car };
const KIND_LABEL = Object.fromEntries(VEHICLE_KINDS.map((k) => [k.id, k.label]));

/** Icon by kind of vehicle: truck (Sprinter), van (Viano, Transporter), car (Dacia, Mercedes T). */
export const VehicleIcon = ({ vehicle, kind, className = 'w-6 h-6' }) => {
  const k = kind || vehicleKind(vehicle);
  const Icon = KIND_ICON[k] || Car;
  return <Icon className={className} role="img" aria-label={KIND_LABEL[k]} />;
};
