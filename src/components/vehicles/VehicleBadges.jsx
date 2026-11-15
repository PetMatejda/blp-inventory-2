import React from 'react';
import { AlertTriangle, CalendarCheck, Truck, ChevronRight } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { fleetAlerts, todayIso, worstLevel } from '../../domain/vehicles';
import { plural } from '../../domain/labels';

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

/** Dashboard strip: vehicles whose STK or vignette is due soon or over. Hidden when all is fine. */
export const VehicleAlertsBanner = () => {
  const { vehicles, setIsVehiclesOpen } = useInventory();
  const list = fleetAlerts(vehicles, todayIso());
  if (!list.length) return null;
  const level = worstLevel(list.flatMap((x) => x.alerts));
  const red = level === 'expired' || level === 'danger';
  return (
    <button
      type="button"
      onClick={() => setIsVehiclesOpen(true)}
      className={`w-full text-left rounded-2xl border p-3 flex items-start gap-3 active:scale-[0.99] ${red ? 'bg-error-container/25 border-error/50' : 'bg-amber-500/10 border-amber-500/50'}`}
    >
      <Truck className={`w-6 h-6 shrink-0 mt-0.5 ${red ? 'text-error' : 'text-amber-600 dark:text-amber-300'}`} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-on-surface">
          {list.length === 1 ? 'Auto potřebuje pozornost'
            : `${list.length} ${plural(list.length, 'auto', 'auta', 'aut')} ${plural(list.length, 'potřebuje', 'potřebují', 'potřebuje')} pozornost`}
        </span>
        <span className="block text-sm text-on-surface-variant">
          {list.map(({ vehicle, alerts }) => `${vehicle.name} ${vehicle.plate}: ${alerts.map((a) => a.text).join(', ')}`).join(' · ')}
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-outline shrink-0 mt-0.5" />
    </button>
  );
};
