import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemSwipeCard } from './ItemSwipeCard';
import {
  Search, QrCode, Plus, Package, Lock, Unlock,
  Truck, Copy, X, AlertTriangle, BookOpen
} from 'lucide-react';


export const PackingList = () => {
  const {
    currentJob,
    jobItems,
    selectedStatusFilter,
    setSelectedStatusFilter,
    searchQuery,
    setSearchQuery,
    setIsAdHocModalOpen,
    setIsScannerModalOpen,
    setActiveTab,
    toggleJobMode,
    finishJob,
    reactivateJob,
    setTemplateJob,
    setEditingJob,
  } = useInventory();

  const [fabOpen, setFabOpen] = useState(false);

  // Close FAB when scrolling
  useEffect(() => {
    const handleScroll = () => { if (fabOpen) setFabOpen(false); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fabOpen]);

  if (!currentJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-outline flex flex-col items-center gap-4">
        <Package className="w-16 h-16 text-outline/40" />
        <p className="text-lg">Vyberte nebo vytvořte zakázku v záložce Dashboard.</p>
        <button
          onClick={() => setActiveTab('dashboard')}
          className="px-6 py-3 bg-primary text-on-primary-container font-semibold rounded-2xl active:scale-95 transition-transform"
        >
          Přejít na Dashboard
        </button>
      </div>
    );
  }

  const isArchived = currentJob.status === 'ARCHIVED';
  const isModeDerigging = currentJob.mode === 'DERIGGING';

  // Filter items
  const filteredItems = jobItems.filter((item) => {
    if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !item.name.toLowerCase().includes(q) &&
        !item.serialNumber?.toLowerCase().includes(q) &&
        !item.category.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalCount = jobItems.length;
  const pendingCount = jobItems.filter(i => i.status === 'PENDING').length;
  const loadedCount = jobItems.filter(i => i.status === 'LOADED').length;
  const packedCount = jobItems.filter(i => i.status === 'PACKED').length;
  const damagedCount = jobItems.filter(i => i.status === 'DAMAGED').length;

  const doneCount = isModeDerigging ? packedCount : loadedCount;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const statusFilters = [
    { id: 'ALL', label: 'Vše', count: totalCount, activeClass: 'bg-primary text-on-primary-container border-primary' },
    { id: 'PENDING', label: 'K naložení', count: pendingCount, dot: '#475569', activeClass: 'bg-surface-variant text-on-surface border-outline' },
    { id: 'LOADED', label: 'Na place', count: loadedCount, dot: '#10b981', activeClass: 'bg-secondary text-on-secondary-container border-secondary' },
    { id: 'PACKED', label: 'K odvozu', count: packedCount, dot: '#06b6d4', activeClass: 'bg-tertiary-container text-on-tertiary-container border-tertiary' },
    { id: 'DAMAGED', label: 'Závada', count: damagedCount, dot: '#ef4444', activeClass: 'bg-error-container text-on-error-container border-error' },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-32">

      {/* ── STICKY COMMAND BAR — sits directly below TopAppBar ── */}
      <div className="sticky top-14 z-30 bg-background">

        {/* Archived banner */}
        {isArchived && (
          <div className="bg-surface-container border-b border-outline px-4 py-2 flex justify-between items-center gap-2 text-xs">
            <div className="flex items-center gap-2 text-outline">
              <Lock className="w-3.5 h-3.5 text-tertiary shrink-0" />
              <span><strong className="text-on-surface">Archivováno</strong> — pouze pro čtení</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTemplateJob(currentJob)}
                className="px-2.5 py-1 bg-surface-variant text-on-surface font-semibold rounded-lg flex items-center gap-1 border border-outline-variant active:scale-95"
              >
                <Copy className="w-3 h-3 text-secondary" /> Vzor
              </button>
              <button
                onClick={() => reactivateJob(currentJob.id)}
                className="px-2.5 py-1 bg-secondary text-on-secondary-container font-bold rounded-lg flex items-center gap-1 active:scale-95"
              >
                <Unlock className="w-3 h-3" /> Obnovit
              </button>
            </div>
          </div>
        )}

        {/* Compact mode strip: mode switcher + progress — single line */}
        <div className="bg-surface-container backdrop-blur-md border-b border-outline-variant px-3 py-1">
          <div className="flex items-center gap-2">
            {/* Mode switcher — inline pills */}
            {!isArchived && (
              <div className="flex bg-surface-container-high rounded-lg p-0.5 border border-outline-variant gap-0.5 shrink-0">
                <button
                  onClick={() => isModeDerigging && toggleJobMode()}
                  className={`py-1 px-2 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                    !isModeDerigging
                      ? 'bg-secondary text-on-secondary-container shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <Package className="w-3 h-3" /> Rigging
                </button>
                <button
                  onClick={() => !isModeDerigging && toggleJobMode()}
                  className={`py-1 px-2 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isModeDerigging
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <Truck className="w-3 h-3" /> Derigging
                </button>
              </div>
            )}

            {/* Progress bar — fills remaining space */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isModeDerigging ? 'bg-blue-500 dark:bg-blue-400' : 'bg-secondary'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-on-surface-variant shrink-0">
                {doneCount}/{totalCount}
              </span>
              {damagedCount > 0 && (
                <span className="text-[10px] text-error flex items-center gap-0.5 shrink-0">
                  <AlertTriangle className="w-3 h-3" /> {damagedCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search bar + Scanner */}
        <div className="bg-surface-container backdrop-blur-md border-b border-outline-variant px-3 py-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat techniku, SN..."
              className="w-full h-9 pl-9 pr-9 bg-surface-container border border-outline-variant rounded-xl text-on-surface text-sm focus:border-primary focus:outline-none placeholder:text-outline"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsScannerModalOpen(true)}
            disabled={isArchived}
            className="w-9 h-9 bg-surface-container border border-outline-variant rounded-xl flex items-center justify-center text-primary disabled:opacity-40 active:scale-90 transition-transform shrink-0"
            title="QR / Barcode Skener"
          >
            <QrCode className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Status filter pills */}
        <div className="bg-surface-container backdrop-blur-md px-3 py-1 border-b border-outline-variant/50">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {statusFilters.map((f) => {
              const isActive = selectedStatusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedStatusFilter(f.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all shrink-0 active:scale-95 ${
                    isActive
                      ? f.activeClass
                      : 'bg-surface-container text-on-surface-variant border-outline-variant'
                  }`}
                >
                  {f.dot && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: f.dot }}
                    />
                  )}
                  {f.label}
                  <span
                    className={`font-mono font-bold text-[10px] px-1 rounded ${
                      isActive ? 'bg-black/20' : 'bg-surface-container-high'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* ── END STICKY ── */}


      {/* Item List */}
      <div className="flex flex-col gap-2.5 px-3 pt-2">

        {filteredItems.length === 0 ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-outline flex flex-col items-center gap-2">
            <Package className="w-10 h-10 text-outline/40" />
            <p className="text-sm">
              {searchQuery
                ? `Žádná shoda pro „${searchQuery}"`
                : 'Žádné položky v tomto filtru.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <ItemSwipeCard key={item.id} item={item} />
          ))
        )}
      </div>

      {/* ════════════════════════════════════════════
          FAB — Floating Action Button
          (hidden when archived)
      ════════════════════════════════════════════ */}
      {!isArchived && (
        <>
          {/* FAB backdrop when open */}
          {fabOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setFabOpen(false)}
            />
          )}

          {/* FAB sub-actions (shown when open) */}
          {fabOpen && (
            <div className="fixed right-4 z-50 flex flex-col items-end gap-2" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => { setIsAdHocModalOpen(true); setFabOpen(false); }}
                className="flex items-center gap-2.5 bg-card-bg border border-outline-variant text-on-surface font-semibold text-sm px-4 h-12 rounded-2xl shadow-xl active:scale-95 transition-transform"
              >
                <span className="text-xs font-mono text-secondary font-bold">Ad-Hoc</span>
                Vlastní položka
                <Plus className="w-4 h-4 text-secondary" />
              </button>
              <button
                onClick={() => { setActiveTab('catalog'); setFabOpen(false); }}
                className="flex items-center gap-2.5 bg-card-bg border border-outline-variant text-on-surface font-semibold text-sm px-4 h-12 rounded-2xl shadow-xl active:scale-95 transition-transform"
              >
                <span className="text-xs font-mono text-primary font-bold">Katalog</span>
                Z katalogu techniky
                <BookOpen className="w-4 h-4 text-primary" />
              </button>
            </div>
          )}

          {/* FAB main button */}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={`fixed right-4 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-90 ${
              fabOpen
                ? 'bg-error-container border-2 border-error/60 text-error rotate-45'
                : 'bg-secondary border-2 border-secondary/60 text-on-secondary-container'
            }`}
            style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}
            title={fabOpen ? 'Zavřít' : 'Přidat položku do zakázky'}
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </>
      )}
    </div>
  );
};
