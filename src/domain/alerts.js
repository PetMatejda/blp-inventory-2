// "Upozornění": everything that needs someone's attention, from all parts of the app.
// Pure function over the live data; the UI groups by severity and opens `target`.
//
// severity: 'critical' (act now) | 'warning' (soon) | 'info' (good to know)
// target:   where a tap leads — { tab: 'vehicles', vehicleId } | { tab: 'catalog', warehouseTab, catalogId? }
//           | { tab: 'packing', jobId }
import { vehicleAlerts } from './vehicles.js';
import { plural } from './labels.js';

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };
const GROUP_RANK = { vehicles: 0, stock: 1, jobs: 2 };
export const ALERT_GROUPS = { vehicles: 'Auta', stock: 'Sklad', jobs: 'Zakázky' };
const ks = (n) => `${n} ks`;

export function buildAlerts({ vehicles = [], stockLevels = [], stockUnits = [], catalog = [], jobs = [], jobItems = [], stocktakes = [] }, today) {
  const alerts = [];
  const nameOf = (id) => catalog.find((c) => c.id === id)?.name || id;

  // Vehicles: STK and motorway vignette.
  for (const v of vehicles) {
    if (v.active === false) continue;
    for (const s of vehicleAlerts(v, today)) {
      alerts.push({
        id: `vehicle-${v.id}-${s.kind}`,
        group: 'vehicles',
        severity: s.level === 'warn' ? 'warning' : 'critical',
        title: `${v.name} ${v.plate}`,
        detail: s.text,
        sortKey: s.days,
        target: { tab: 'vehicles', vehicleId: v.id },
      });
    }
  }

  // Warehouse: pieces missing after a job, pieces in service.
  for (const level of stockLevels) {
    const id = level.catalogId || level.id;
    if (level.missing > 0) {
      const codes = stockUnits.filter((u) => u.catalogId === id && u.status === 'MISSING').map((u) => u.code);
      alerts.push({
        id: `missing-${id}`, group: 'stock', severity: 'critical',
        title: nameOf(id),
        detail: `Chybí po zakázce: ${ks(level.missing)}${codes.length ? ` (${codes.join(', ')})` : ''}`,
        sortKey: -level.missing,
        target: { tab: 'catalog', warehouseTab: 'stock', catalogId: id },
      });
    }
    if (level.inService > 0) {
      const codes = stockUnits.filter((u) => u.catalogId === id && u.status === 'IN_SERVICE').map((u) => u.code);
      alerts.push({
        id: `service-${id}`, group: 'stock', severity: 'warning',
        title: nameOf(id),
        detail: `V servisu: ${ks(level.inService)}${codes.length ? ` (${codes.join(', ')})` : ''}`,
        sortKey: -level.inService,
        target: { tab: 'catalog', warehouseTab: 'stock', catalogId: id },
      });
    }
  }

  // Active jobs: damaged equipment reported on site.
  for (const job of jobs) {
    if (job.status !== 'ACTIVE') continue;
    const damaged = jobItems.filter((i) => i.jobId === job.id && i.status === 'DAMAGED');
    if (!damaged.length) continue;
    alerts.push({
      id: `damaged-${job.id}`, group: 'jobs', severity: 'warning',
      title: job.name,
      detail: `${damaged.length} ${plural(damaged.length, 'položka se závadou', 'položky se závadou', 'položek se závadou')}: ${damaged.map((i) => i.name).slice(0, 3).join(', ')}${damaged.length > 3 ? '…' : ''}`,
      sortKey: -damaged.length,
      target: { tab: 'packing', jobId: job.id },
    });
  }

  // A stocktake that is still open.
  for (const st of stocktakes) {
    if (st.status !== 'OPEN') continue;
    alerts.push({
      id: `stocktake-${st.id}`, group: 'stock', severity: 'info',
      title: 'Probíhá inventura',
      detail: st.startedBy ? `Zahájil(a) ${String(st.startedBy).replace(/\s*\([A-Z]+\)$/, '')}` : 'Dokončete ji, ať se stavy srovnají.',
      sortKey: 0,
      target: { tab: 'catalog', warehouseTab: 'stocktake' },
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    || GROUP_RANK[a.group] - GROUP_RANK[b.group]
    || a.sortKey - b.sortKey
    || a.title.localeCompare(b.title, 'cs'));
}

/** Counts for badges. `urgent` = critical + warning (what the badge shows). */
export function alertCounts(alerts) {
  const c = { critical: 0, warning: 0, info: 0 };
  for (const a of alerts) c[a.severity]++;
  return { ...c, urgent: c.critical + c.warning, total: alerts.length };
}
