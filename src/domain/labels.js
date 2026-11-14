// One vocabulary per job phase (ANALYZA_A_NAVRH.md, 3.3).
// The same status means something different while loading at the warehouse
// and while packing up on set, so labels and filters depend on the mode.

export const PHASES = {
  LOADING: {
    id: 'LOADING',
    name: 'Rigging',
    description: 'Nakládka ze skladu do aut',
    doneStatus: 'LOADED',
    // A packed item was loaded before, so it never counts as "to load".
    doneStatuses: ['LOADED', 'PACKED'],
    doneLabel: 'Naloženo',
    remainingLabel: 'Zbývá naložit',
    swipeDone: 'NALOŽENO',
    swipeUndo: 'VRÁTIT KE SKLADU',
    progressLabel: 'Naloženo',
    allDone: 'Vše naloženo',
  },
  DERIGGING: {
    id: 'DERIGGING',
    name: 'Derigging',
    description: 'Balení na placu a odvoz',
    doneStatus: 'PACKED',
    doneStatuses: ['PACKED'],
    doneLabel: 'Sbaleno',
    remainingLabel: 'Zbývá sbalit',
    swipeDone: 'SBALENO',
    swipeUndo: 'VRÁTIT NA PLAC',
    progressLabel: 'Sbaleno',
    allDone: 'Vše sbaleno',
  },
  RESTOCK: {
    id: 'RESTOCK',
    name: 'Naskladnění',
    description: 'Vrácení techniky do skladu',
    doneStatus: 'RESTOCKED',
    doneStatuses: ['RESTOCKED'],
    doneLabel: 'Naskladněno',
    remainingLabel: 'Zbývá naskladnit',
    swipeDone: 'NASKLADNĚNO',
    swipeUndo: 'NEZAPOČÍTAT',
    progressLabel: 'Naskladněno',
    allDone: 'Vše naskladněno',
  },
};

/** Order of phases of a job. */
export const PHASE_ORDER = ['LOADING', 'DERIGGING', 'RESTOCK'];

export const phaseOf = (mode) => PHASES[mode] || PHASES.LOADING;

/** Czech plural: plural(1,'položka','položky','položek') → 'položka'; 2–4 → few; 0, 5+ → many. */
export function plural(n, one, few, many) {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}

/** Status label as the crew says it in the current phase. */
export function statusLabel(status, mode = 'LOADING') {
  if (status === 'DAMAGED') return 'Závada';
  if (mode === 'RESTOCK') return status === 'RESTOCKED' ? 'Naskladněno' : 'K naskladnění';
  if (mode === 'DERIGGING') {
    if (status === 'PACKED') return 'Sbaleno';
    if (status === 'LOADED') return 'Na placu';
    return 'Neúplné';
  }
  if (status === 'LOADED') return 'Naloženo';
  if (status === 'PACKED') return 'Sbaleno';
  return 'K naložení';
}

/** Filters shown for the phase; REMAINING is the default. */
export function filtersFor(mode = 'LOADING') {
  const p = phaseOf(mode);
  return [
    { id: 'REMAINING', label: p.remainingLabel },
    { id: 'DONE', label: p.doneLabel },
    { id: 'DAMAGED', label: 'Závady' },
    { id: 'ALL', label: 'Vše' },
  ];
}

/** Does the item belong to the filter in this phase? */
export function matchesFilter(item, filterId, mode = 'LOADING') {
  const done = phaseOf(mode).doneStatuses;
  switch (filterId) {
    case 'REMAINING': return !done.includes(item.status) && item.status !== 'DAMAGED';
    case 'DONE': return done.includes(item.status);
    case 'DAMAGED': return item.status === 'DAMAGED';
    default: return true;
  }
}

/** Counts for each filter of the phase. */
export function filterCounts(items, mode = 'LOADING') {
  return Object.fromEntries(filtersFor(mode).map((f) => [f.id, items.filter((i) => matchesFilter(i, f.id, mode)).length]));
}

/** Summary used when finishing a phase or a job. */
export function phaseSummary(items, mode = 'LOADING') {
  const remaining = items.filter((i) => matchesFilter(i, 'REMAINING', mode));
  const totalPieces = items.reduce((s, i) => s + (i.quantityRequested || 0), 0);
  // Progress by pieces: loaded pieces while rigging, packed pieces while derigging,
  // pieces counted back while restocking.
  const donePieces = items.reduce((s, i) => {
    const counted = Math.min(i.quantityLoaded || 0, i.quantityRequested || 0);
    if (mode === 'DERIGGING') return s + (i.status === 'PACKED' ? counted : 0);
    if (mode === 'RESTOCK') return s + (i.status === 'DAMAGED' ? 0 : counted);
    return s + (i.status === 'DAMAGED' ? 0 : counted);
  }, 0);
  return {
    totalPieces,
    donePieces,
    percent: totalPieces ? Math.round((donePieces / totalPieces) * 100) : 0,
    total: items.length,
    done: items.filter((i) => matchesFilter(i, 'DONE', mode)).length,
    remaining,
    damaged: items.filter((i) => i.status === 'DAMAGED'),
    missingPieces: remaining.reduce((s, i) => s + Math.max(0, (i.quantityRequested || 0) - (mode === 'DERIGGING' ? 0 : (i.quantityLoaded || 0))), 0),
  };
}
