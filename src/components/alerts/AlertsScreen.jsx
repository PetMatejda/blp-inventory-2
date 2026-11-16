import React, { useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { alertCounts, ALERT_GROUPS } from '../../domain/alerts';
import { AlertCard, SEVERITY } from './AlertCard';

/**
 * Upozornění: everything that needs attention in one list — cars (STK, vignette),
 * missing pieces and pieces in service, damage on active jobs, open stocktake.
 * Grouped by urgency; a filter by area; each row opens the place to act.
 */
export const AlertsScreen = () => {
  const { alerts, openTarget } = useInventory();
  const [group, setGroup] = useState('ALL');
  const counts = alertCounts(alerts);
  const visible = alerts.filter((a) => group === 'ALL' || a.group === group);
  const groups = Object.keys(ALERT_GROUPS).filter((g) => alerts.some((a) => a.group === g));

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-on-surface flex items-center gap-2"><Bell className="w-6 h-6 text-primary" /> Upozornění</h1>
        <p className="text-sm text-on-surface-variant">
          {counts.total ? 'Klepnutím otevřete místo, kde se věc řeší.' : 'Auta, sklad i zakázky jsou v pořádku.'}
        </p>
      </div>

      {counts.total === 0 ? (
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-10 text-center flex flex-col items-center gap-3">
          <CheckCircle2 className="w-14 h-14 text-secondary" />
          <p className="text-lg font-bold text-on-surface">Vše v pořádku</p>
          <p className="text-sm text-on-surface-variant max-w-xs">Žádná propadlá STK ani známka, nic v servisu, nic nechybí.</p>
        </div>
      ) : (
        <>
          {/* Overview: counts by urgency */}
          <div className="grid grid-cols-3 gap-2">
            {['critical', 'warning', 'info'].map((s) => (
              <div key={s} className={`rounded-xl border p-3 ${counts[s] ? SEVERITY[s].chip : 'border-outline-variant bg-card-bg text-on-surface-variant'}`}>
                <div className="text-2xl font-bold leading-none">{counts[s]}</div>
                <div className="text-xs font-semibold mt-1">{SEVERITY[s].label}</div>
              </div>
            ))}
          </div>

          {/* Filter by area (only areas that have something) */}
          {groups.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Oblast">
              {[['ALL', 'Vše', counts.total], ...groups.map((g) => [g, ALERT_GROUPS[g], alerts.filter((a) => a.group === g).length])].map(([id, label, n]) => (
                <button key={id} role="tab" aria-selected={group === id} onClick={() => setGroup(id)}
                  className={`h-10 px-3 rounded-xl text-sm font-semibold whitespace-nowrap border shrink-0 ${group === id ? 'bg-primary text-on-primary border-primary' : 'bg-card-bg border-outline-variant text-on-surface-variant'}`}>
                  {label} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
          )}

          {['critical', 'warning', 'info'].map((s) => {
            const list = visible.filter((a) => a.severity === s);
            if (!list.length) return null;
            return (
              <section key={s} className="flex flex-col gap-2" aria-labelledby={`alerts-${s}`}>
                <h2 id={`alerts-${s}`} className="text-sm font-bold uppercase tracking-wide text-on-surface-variant flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${SEVERITY[s].stripe}`} /> {SEVERITY[s].label}
                </h2>
                {list.map((a) => <AlertCard key={a.id} alert={a} onOpen={openTarget} />)}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
};
