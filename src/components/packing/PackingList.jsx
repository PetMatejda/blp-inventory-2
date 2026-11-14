import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useDialogs } from '../common/Dialogs';
import { ItemSwipeCard } from './ItemSwipeCard';
import { phaseOf, filtersFor, filterCounts, matchesFilter, phaseSummary, plural } from '../../domain/labels';
import {
  Search, QrCode, Plus, Package, Lock, Unlock, Truck, Copy, X, BookOpen, FileText, CheckCircle2, ArrowRight,
} from 'lucide-react';

export const PackingList = () => {
  const {
    currentJob, jobItems, selectedStatusFilter, setSelectedStatusFilter, searchQuery, setSearchQuery,
    setIsAdHocModalOpen, setIsScannerModalOpen, setActiveTab, toggleJobMode, reactivateJob,
    setTemplateJob, setIsProtocolModalOpen, setFinishingJob,
  } = useInventory();
  const { confirm, toast } = useDialogs();
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => { if (fabOpen) setFabOpen(false); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fabOpen]);

  if (!currentJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-on-surface-variant flex flex-col items-center gap-4">
        <Package className="w-16 h-16 text-outline/40" />
        <p className="text-lg">Vyberte nebo vytvořte zakázku.</p>
        <button onClick={() => setActiveTab('dashboard')} className="h-14 px-6 bg-primary text-on-primary-container font-semibold rounded-2xl active:scale-95">
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
  const progress = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  const q = searchQuery.trim().toLowerCase();
  // While searching, look through everything so a found item is never hidden by the filter.
  const visibleItems = jobItems.filter((item) => {
    if (q) {
      return item.name.toLowerCase().includes(q)
        || item.serialNumber?.toLowerCase().includes(q)
        || item.category?.toLowerCase().includes(q);
    }
    return matchesFilter(item, activeFilter, mode);
  });

  const switchPhase = async () => {
    const ok = await confirm(isDerigging ? {
      title: 'Vrátit do riggingu?',
      message: 'Swipe bude znovu znamenat „naloženo“.',
      confirmLabel: 'Zpět na rigging',
    } : {
      title: 'Zahájit derigging?',
      message: summary.remaining.length
        ? `${summary.remaining.length} ${plural(summary.remaining.length, 'položka není naložená', 'položky nejsou naložené', 'položek není naložených')}. Derigging se týká jen techniky, která je na placu.\n\nSwipe bude znamenat „sbaleno k odvozu“.`
        : 'Vše je naložené. Swipe bude znamenat „sbaleno k odvozu“.',
      confirmLabel: 'Zahájit derigging',
    });
    if (ok) {
      toggleJobMode();
      setSelectedStatusFilter('REMAINING');
      toast({ text: isDerigging ? 'Fáze: Rigging' : 'Fáze: Derigging' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32">
      {/* Sticky command bar */}
      <div className="sticky top-14 z-30 bg-surface-container border-b border-outline-variant shadow-sm">
        {isArchived && (
          <div className="bg-surface-container-high border-b border-outline px-4 py-2 flex justify-between items-center gap-2">
            <span className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Lock className="w-4 h-4 text-tertiary shrink-0" /> <strong className="text-on-surface">Archiv</strong> – jen pro čtení
            </span>
            <div className="flex gap-2">
              <button onClick={() => setTemplateJob(currentJob)} className="h-11 px-3 bg-surface-container text-on-surface text-sm font-semibold rounded-xl flex items-center gap-1.5 border border-outline-variant">
                <Copy className="w-4 h-4 text-secondary" /> Vzor
              </button>
              <button onClick={() => { reactivateJob(currentJob.id); toast({ text: 'Zakázka obnovena' }); }} className="h-11 px-3 bg-secondary text-on-secondary-container text-sm font-bold rounded-xl flex items-center gap-1.5">
                <Unlock className="w-4 h-4" /> Obnovit
              </button>
            </div>
          </div>
        )}

        {/* Phase + progress */}
        <div className="px-3 pt-2.5 pb-2 border-b border-outline-variant/60">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${isDerigging ? 'text-cyan-700 dark:text-cyan-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {isDerigging ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              {phase.name} <span className="font-normal text-on-surface-variant">· {phase.description}</span>
            </span>
            {!isArchived && (
              <button onClick={switchPhase} className="h-9 px-3 rounded-xl text-sm font-semibold border border-outline-variant bg-card-bg text-on-surface flex items-center gap-1 shrink-0">
                {isDerigging ? 'Rigging' : 'Derigging'} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant/40"
              role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={phase.progressLabel}>
              <div className={`h-full rounded-full transition-all duration-500 ${isDerigging ? 'bg-cyan-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-mono font-bold text-on-surface shrink-0">{summary.done}/{summary.total}</span>
          </div>
        </div>

        {/* Search + scanner + protocol */}
        <div className="px-3 py-2 border-b border-outline-variant/60 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                    active ? 'bg-primary text-on-primary-container border-primary' : 'bg-card-bg text-on-surface-variant border-outline-variant'
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

      {/* Items */}
      <div className="flex flex-col gap-3 px-3 pt-4 pb-8">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => <ItemSwipeCard key={item.id} item={item} />)
        ) : q ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant">Nic neodpovídá „{searchQuery}“.</div>
        ) : activeFilter === 'REMAINING' && summary.total > 0 ? (
          <div className="bg-card-bg border border-secondary/40 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-secondary" />
            <p className="text-lg font-bold text-on-surface">{phase.allDone}</p>
            {summary.damaged.length > 0 && <p className="text-sm text-error font-semibold">{summary.damaged.length} {plural(summary.damaged.length, 'položka má', 'položky mají', 'položek má')} nahlášenou závadu.</p>}
            {!isArchived && (isDerigging ? (
              <button onClick={() => setFinishingJob(currentJob)} className="h-14 px-6 rounded-2xl bg-secondary text-on-secondary-container font-bold flex items-center gap-2">
                <Lock className="w-5 h-5" /> Ukončit zakázku…
              </button>
            ) : (
              <button onClick={switchPhase} className="h-14 px-6 rounded-2xl bg-secondary text-on-secondary-container font-bold flex items-center gap-2">
                <Truck className="w-5 h-5" /> Zahájit derigging
              </button>
            ))}
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
          {fabOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setFabOpen(false)} />}
          {fabOpen && (
            <div className="fixed right-4 z-50 flex flex-col items-end gap-2" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => { setActiveTab('catalog'); setFabOpen(false); }} className="flex items-center gap-2.5 bg-card-bg border border-outline-variant text-on-surface font-semibold text-base px-4 h-14 rounded-2xl shadow-xl">
                <BookOpen className="w-5 h-5 text-primary" /> Z katalogu
              </button>
              <button onClick={() => { setIsAdHocModalOpen(true); setFabOpen(false); }} className="flex items-center gap-2.5 bg-card-bg border border-outline-variant text-on-surface font-semibold text-base px-4 h-14 rounded-2xl shadow-xl">
                <Plus className="w-5 h-5 text-secondary" /> Vlastní položka
              </button>
            </div>
          )}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={`fixed right-4 z-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-90 ${
              fabOpen ? 'bg-error-container border-2 border-error/60 text-error rotate-45' : 'bg-secondary border-2 border-secondary/60 text-on-secondary-container'
            }`}
            style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}
            aria-label={fabOpen ? 'Zavřít' : 'Přidat techniku do zakázky'}
          >
            <Plus className="w-8 h-8 stroke-[2.5]" />
          </button>
        </>
      )}
    </div>
  );
};
