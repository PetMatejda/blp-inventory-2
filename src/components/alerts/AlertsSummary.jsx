import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { alertCounts } from '../../domain/alerts';
import { plural } from '../../domain/labels';
import { AlertCard, SEVERITY } from './AlertCard';

/**
 * Dashboard card: the most urgent alerts (critical + soon), max. 3, and a link
 * to the full list. Hidden when nothing is urgent — info alone does not nag.
 */
export const AlertsSummary = () => {
  const { alerts, openTarget, setActiveTab } = useInventory();
  const counts = alertCounts(alerts);
  if (!counts.urgent) return null;
  const top = alerts.filter((a) => a.severity !== 'info').slice(0, 3);
  const more = counts.total - top.length;

  return (
    <section aria-labelledby="alerts-summary" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="alerts-summary" className="font-bold text-on-surface flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Upozornění
        </h2>
        <span className="flex gap-1.5">
          {['critical', 'warning'].filter((s) => counts[s]).map((s) => (
            <span key={s} className={`px-2 py-0.5 rounded-full border text-xs font-bold ${SEVERITY[s].chip}`}>
              {SEVERITY[s].label} {counts[s]}
            </span>
          ))}
        </span>
      </div>
      {top.map((a) => <AlertCard key={a.id} alert={a} onOpen={openTarget} compact />)}
      {more > 0 && (
        <button type="button" onClick={() => setActiveTab('alerts')}
          className="h-11 rounded-xl border border-outline-variant bg-card-bg text-sm font-semibold text-primary flex items-center justify-center gap-1">
          Všechna upozornění (další {more} {plural(more, 'položka', 'položky', 'položek')}) <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </section>
  );
};
