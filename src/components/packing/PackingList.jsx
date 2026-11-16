import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useDialogs, Sheet, SheetAction } from '../common/Dialogs';
import { ItemSwipeCard } from './ItemSwipeCard';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useHideOnScroll } from '../../hooks/useHideOnScroll';

import { phaseOf, filtersFor, filterCounts, matchesFilter, phaseSummary, plural } from '../../domain/labels';
import {
  Search, QrCode, Plus, Package, Lock, Unlock, Truck, Copy, X, BookOpen, FileText, CheckCircle2, ArrowRight, Warehouse,
} from 'lucide-react';
import { matchesSearch, SEARCH_INPUT_PROPS } from '../../domain/search';

const PHASE_COLOR = {
  LOADING: 'text-emerald-700 dark:text-emerald-300',
  DERIGGING: 'text-cyan-700 dark:text-cyan-300',
  RESTOCK: 'text-violet-700 dark:text-violet-300',
};
const PHASE_BAR = { LOADING: 'bg-emerald-500', DERIGGING: 'bg-cyan-500', RESTOCK: 'bg-violet-500' };

export const PackingList = () => {
  const {
    currentJob, jobItems, selectedStatusFilter, setSelectedStatusFilter, searchQuery, setSearchQuery,
    setIsAdHocModalOpen, setIsScannerModalOpen, setActiveTab, changeJobPhase, reactivateJob,
    setTemplateJob, setIsProtocolModalOpen, setFinishingJob, availabilityFor, stockLevels, setWarehouseTab,
    stock, addCatalogItemToJob, isScannerModalOpen,
  } = useInventory();
  const { confirm, toast } = useDialogs();
  const [fabOpen, setFabOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  // Scrolling down hides search + filters so more of the list fits on a phone.
  const toolsHidden = useHideOnScroll({ enabled: !searchQuery && !searchFocused });

  // Hardware barcode reader: scan anywhere on the packing screen (no dialog needed).
  useBarcodeScanner((code) => {
    const r = stock.scanOnJob(currentJob.id, code);
    if (navigator.vibrate) navigator.vibrate(r.ok ? 60 : [80, 60, 80]);
    if (r.ok) toast({ text: `✓ ${r.message}${r.warning ? ` — ${r.warning}` : ''}` });
    else if (r.needsAdd) toast({ text: r.message, actionLabel: 'Přidat', onAction: () => addCatalogItemToJob(r.needsAdd) });
    else toast({ text: `✗ ${r.message}` });
  }, { enabled: !!currentJob && currentJob.status !== 'ARCHIVED' && !isScannerModalOpen });

  if (!currentJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-on-surface-variant flex flex-col items-center gap-4">
        <Package className="w-16 h-16 text-outline/40" />
        <p className="text-lg">Vyberte nebo vytvořte zakázku.</p>
        <button onClick={() => setActiveTab('dashboard')} className="h-14 px-6 bg-primary text-on-primary font-semibold rounded-2xl active:scale-95">
          Přejít na zakázky
        </button>
      </div>
    );
  }

  const isArchived = currentJob.status === 'ARCHIVED';
  const mode = currentJob.mode || 'LOADING';
  const phase = phaseOf(mode);
  const isDerigging = mode === 'DERIGGING';
  const filters = filtersFor(mode);
  const activeFilter = filters.some((f) => f.id === selectedStatusFilter) ? selectedStatusFilter : 'REMAINING';
  const counts = filterCounts(jobItems, mode);
  const summary = phaseSummary(jobItems, mode);
  const progress = summary.percent;
  const isRestock = mode === 'RESTOCK';
  const stockTracked = stockLevels.length > 0;

  // Pieces the warehouse cannot cover in the job's dates (only while planning/loading).
  const shortages = {};
  if (mode === 'LOADING' && !isArchived && stockTracked) {
    for (const item of jobItems) {
      if (!item.catalogId || shortages[item.catalogId] !== undefined) continue;
      shortages[item.catalogId] = availabilityFor(item.catalogId)?.short || 0;
    }
  }

  const q = searchQuery.trim();
  // While searching, look through everything so a found item is never hidden by the filter.
  const visibleItems = jobItems.filter((item) => {
    if (q) {
      return matchesSearch([item.name, item.serialNumber, item.category], q);
    }
    return matchesFilter(item, activeFilter, mode);
  });

  /** Next phase: Rigging → Derigging → Naskladnění (restock is finished in FinishJobSheet). */
  const nextPhase = isDerigging ? 'RESTOCK' : 'DERIGGING';
  const switchPhase = async () => {
    if (isRestock) { setFinishingJob(currentJob); return; }
    const remaining = summary.remaining.length;
    const ok = await confirm(isDerigging ? {
      title: 'Zahájit naskladnění?',
      message: `Sbalená technika se předvyplní jako naskladněná — opravte jen rozdíly. Nesbalené položky a kusy se štítkem se počítají od nuly.${remaining ? `\n\n${remaining} ${plural(remaining, 'položka není sbalená', 'položky nejsou sbalené', 'položek není sbalených')}.` : ''}\n\nPo potvrzení se do deriggingu nedá vrátit.`,
      confirmLabel: 'Zahájit naskladnění',
    } : {
      title: 'Zahájit derigging?',
      message: `${remaining
        ? `${remaining} ${plural(remaining, 'položka není naložená', 'položky nejsou naložené', 'položek není naložených')}. Derigging se týká jen techniky, která je na placu.`
        : 'Vše je naložené.'}${stockTracked ? '\n\nNaložené kusy se odepíšou ze skladu (vydáno na zakázku).' : ''}\n\nSwipe bude znamenat „sbaleno k odvozu“.`,
      confirmLabel: 'Zahájit derigging',
    });
    if (ok) {
      changeJobPhase(nextPhase);
      setSelectedStatusFilter('REMAINING');
      toast({ text: `Fáze: ${phaseOf(nextPhase).name}` });
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32">
      {/* Sticky command bar */}
      <div className="sticky top-app-bar z-30 bg-surface-container border-b border-outline-variant shadow-sm">
        {isArchived && (
          <div className="bg-surface-container-high border-b border-outline px-4 py-2 flex justify-between items-center gap-2">
            <span className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Lock className="w-4 h-4 text-tertiary shrink-0" /> <strong className="text-on-surface">Archiv</strong> – jen pro čtení
            </span>
            <div className="flex gap-2">
              <button onClick={() => setTemplateJob(currentJob)} className="h-11 px-3 bg-surface-container text-on-surface text-sm font-semibold rounded-xl flex items-center gap-1.5 border border-outline-variant">
                <Copy className="w-4 h-4 text-secondary" /> Vzor
              </button>
              <button onClick={() => { reactivateJob(currentJob.id); toast({ text: 'Zakázka obnovena' }); }} className="h-11 px-3 bg-secondary text-on-secondary text-sm font-bold rounded-xl flex items-center gap-1.5">
                <Unlock className="w-4 h-4" /> Obnovit
              </button>
            </div>
          </div>
        )}

        {/* Phase + progress */}
        <div className="px-3 pt-2.5 pb-2 border-b border-outline-variant/60">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold min-w-0 ${PHASE_COLOR[mode]}`}>
              {isRestock ? <Warehouse className="w-4 h-4 shrink-0" /> : isDerigging ? <Truck className="w-4 h-4 shrink-0" /> : <Package className="w-4 h-4 shrink-0" />}
              {phase.name}
            </span>
            {!isArchived && (
              <button onClick={switchPhase} className="h-10 px-3 rounded-xl text-sm font-semibold border border-outline-variant bg-card-bg text-on-surface flex items-center gap-1 shrink-0">
                {isRestock ? 'Dokončit' : phaseOf(nextPhase).name} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant/40"
              role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${phase.progressLabel} ${summary.donePieces} z ${summary.totalPieces} kusů`}>
              <div className={`h-full rounded-full transition-all duration-500 ${PHASE_BAR[mode]}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-mono font-bold text-on-surface shrink-0">{summary.donePieces}/{summary.totalPieces} ks</span>
          </div>
        </div>

        {/* Search + scanner + protocol, filters — collapse while scrolling down */}
        <div className={`grid transition-[grid-template-rows] duration-200 ${toolsHidden ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
        <div className={`min-h-0 overflow-hidden ${toolsHidden ? 'invisible' : ''}`}>
        <div className="px-3 py-2 border-b border-outline-variant/60 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              {...SEARCH_INPUT_PROPS}
              placeholder="Hledat techniku, SN…"
              className="w-full h-12 pl-10 pr-11 bg-card-bg border border-outline-variant rounded-xl text-on-surface text-base focus:border-primary focus:outline-none placeholder:text-outline"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Vymazat hledání" className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-outline">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button onClick={() => setIsScannerModalOpen(true)} disabled={isArchived} aria-label="Skenovat kód"
            className="w-12 h-12 bg-card-bg border border-outline-variant rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-90 shrink-0">
            <QrCode className="w-6 h-6 text-secondary" />
          </button>
          <button onClick={() => setIsProtocolModalOpen(true)} aria-label="Předávací protokol (PDF)"
            className="w-12 h-12 bg-card-bg border border-outline-variant rounded-xl flex items-center justify-center active:scale-90 shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </button>
        </div>

        {/* Filters for this phase */}
        {!q && (
          <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar" role="tablist">
            {filters.map((f) => {
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedStatusFilter(f.id)}
                  className={`h-11 px-4 rounded-xl text-sm font-semibold whitespace-nowrap border shrink-0 flex items-center gap-2 ${
                    active ? 'bg-primary text-on-primary border-primary' : 'bg-card-bg text-on-surface-variant border-outline-variant'
                  } ${f.id === 'DAMAGED' && counts.DAMAGED > 0 && !active ? 'text-error border-error/40' : ''}`}
                >
                  {f.label}
                  <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded-md ${active ? 'bg-black/20' : 'bg-surface-container-high'}`}>{counts[f.id]}</span>
                </button>
              );
            })}
          </div>
        )}
        </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-3 px-3 pt-4 pb-8">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => <ItemSwipeCard key={item.id} item={item} shortage={shortages[item.catalogId] || 0} />)
        ) : q ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant">Nic neodpovídá „{searchQuery}“.</div>
        ) : activeFilter === 'REMAINING' && summary.total > 0 ? (
          <div className="bg-card-bg border border-secondary/40 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-secondary" />
            <p className="text-lg font-bold text-on-surface">{phase.allDone}</p>
            {summary.damaged.length > 0 && <p className="text-sm text-error font-semibold">{summary.damaged.length} {plural(summary.damaged.length, 'položka má', 'položky mají', 'položek má')} nahlášenou závadu.</p>}
            {!isArchived && (
              <button onClick={switchPhase} className="h-14 px-6 rounded-2xl bg-secondary text-on-secondary font-bold flex items-center gap-2">
                {isRestock ? <><Lock className="w-5 h-5" /> Dokončit naskladnění…</>
                  : isDerigging ? <><Warehouse className="w-5 h-5" /> Zahájit naskladnění</>
                    : <><Truck className="w-5 h-5" /> Zahájit derigging</>}
              </button>
            )}
            {!isArchived && isDerigging && (
              <button onClick={() => setFinishingJob(currentJob)} className="text-sm text-on-surface-variant underline">
                Ukončit bez naskladnění
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center gap-2">
            <Package className="w-10 h-10 text-outline/40" />
            <p className="text-base">{summary.total === 0 ? 'Zakázka zatím nemá žádnou techniku.' : 'V tomto filtru nic není.'}</p>
          </div>
        )}
      </div>

      {/* Add item (FAB) */}
      {!isArchived && (
        <>
          {/* The choices open as a bottom sheet, so nothing overlaps them */}
          {fabOpen && (
            <Sheet title="Přidat techniku" subtitle={currentJob.name} onClose={() => setFabOpen(false)}>
              <SheetAction icon={BookOpen} label="Z katalogu" hint="Technika ze skladu BLP"
                onClick={() => { setFabOpen(false); setWarehouseTab('catalog'); setActiveTab('catalog'); }} />
              <SheetAction icon={Plus} label="Vlastní položka" hint="Jen pro tuto zakázku – sklad ani katalog se nemění"
                onClick={() => { setFabOpen(false); setIsAdHocModalOpen(true); }} />
            </Sheet>
          )}
          <button
            onClick={() => setFabOpen(true)}
            className="fixed right-4 z-30 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 bg-secondary border-2 border-secondary/60 text-on-secondary"
            style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}
            aria-label="Přidat techniku do zakázky"
          >
            <Plus className="w-8 h-8 stroke-[2.5]" />
          </button>
        </>
      )}
    </div>
  );
};
