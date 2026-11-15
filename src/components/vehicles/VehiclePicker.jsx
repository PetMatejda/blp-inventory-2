import React from 'react';
import { Truck, Check, AlertTriangle } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { vehicleAlerts, todayIso, worstLevel } from '../../domain/vehicles';

/**
 * Choose the vehicles for a job. A vehicle whose STK or vignette is due soon,
 * already over, or runs out before the job ends shows a warning.
 * Retired vehicles are offered only when the job already uses them.
 */
export const VehiclePicker = ({ value = [], onChange, until }) => {
  const { vehicles, setIsVehiclesOpen } = useInventory();
  const today = todayIso();
  const options = vehicles.filter((v) => v.active !== false || value.includes(v.id));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div>
      <span className="block text-xs font-mono text-outline mb-1 uppercase flex items-center gap-1">
        <Truck className="w-3.5 h-3.5" /> Vozidla
      </span>
      {options.length === 0 ? (
        <button type="button" onClick={() => setIsVehiclesOpen(true)} className="text-sm text-primary font-semibold underline">
          Zatím žádná auta — přidat v Nastavení › Vozidla
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          {options.map((v) => {
            const selected = value.includes(v.id);
            const alerts = vehicleAlerts(v, today, { until });
            const level = worstLevel(alerts);
            const red = level === 'expired' || level === 'danger';
            return (
              <button key={v.id} type="button" onClick={() => toggle(v.id)} aria-pressed={selected}
                className={`w-full min-h-[48px] px-3 py-2 rounded-xl border text-left flex items-center gap-3 active:scale-[0.99] ${
                  selected ? 'bg-primary-container/60 border-primary' : 'bg-surface-container border-outline-variant'}`}>
                <span className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary text-on-primary-container' : 'border-outline'}`}>
                  {selected && <Check className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-on-surface">{v.name}</span>{' '}
                  <span className="text-xs font-mono text-on-surface-variant">{v.plate}</span>
                  {alerts.length > 0 && (
                    <span className={`flex items-center gap-1 text-xs font-semibold mt-0.5 ${red ? 'text-error' : 'text-amber-700 dark:text-amber-300'}`}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {alerts.map((a) => a.text).join(', ')}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
