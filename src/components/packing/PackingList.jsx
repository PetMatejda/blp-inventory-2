import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemSwipeCard } from './ItemSwipeCard';
import { Search, QrCode, Plus, Package, BookOpen, Lock, Unlock, Calendar, Truck, Copy, ChevronUp, ChevronDown, Repeat } from 'lucide-react';

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
    setContextMenu
  } = useInventory();

  const [isScrolled, setIsScrolled] = useState(false);
  const [manualCollapse, setManualCollapse] = useState(null); // null = auto by scroll, true/false = manual override

  // Track window scroll to collapse/expand header
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollPos > 25) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
    };
  }, []);

  if (!currentJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-outline flex flex-col items-center gap-4">
        <Package className="w-16 h-16 text-outline/40" />
        <p className="text-lg">Vyberte nebo vytvořte zakázku v záložce Dashboard.</p>
        <button
          onClick={() => setActiveTab('dashboard')}
          className="px-6 py-2.5 bg-primary text-on-primary-container font-semibold rounded-xl"
        >
          Přejít na Dashboard
        </button>
      </div>
    );
  }

  const isArchived = currentJob.status === 'ARCHIVED';
  const isModeDerigging = currentJob.mode === 'DERIGGING';

  // Effective collapse state (manual override takes precedence if set, otherwise isScrolled)
  const shouldCollapse = manualCollapse !== null ? manualCollapse : isScrolled;

  // Filter items
  const filteredItems = jobItems.filter((item) => {
    if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSerial = item.serialNumber?.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      if (!matchName && !matchSerial && !matchCategory) return false;
    }
    return true;
  });

  const totalCount = jobItems.length;
  const pendingCount = jobItems.filter(i => i.status === 'PENDING').length;
  const loadedCount = jobItems.filter(i => i.status === 'LOADED').length;
  const packedCount = jobItems.filter(i => i.status === 'PACKED').length;
  const damagedCount = jobItems.filter(i => i.status === 'DAMAGED').length;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-3 pb-28 flex flex-col gap-4">
      {/* Read-Only Lock Banner if Archived */}
      {isArchived && (
        <div className="bg-surface-container border-2 border-outline p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs text-on-surface shadow-md">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-tertiary shrink-0" />
            <div>
              <strong className="block text-sm font-bold text-on-surface">Zakázka je ukončena (Archivováno)</strong>
              <span className="text-outline">Položky a stavy jsou uzamčeny pouze pro čtení. Pro úpravy obnovte zakázku.</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTemplateJob(currentJob)}
              className="px-3 py-2 bg-surface-variant hover:bg-surface-bright text-on-surface font-semibold rounded-xl flex items-center gap-1.5 border border-outline-variant"
            >
              <Copy className="w-4 h-4 text-secondary" /> Použít jako vzor
            </button>
            <button
              onClick={() => reactivateJob(currentJob.id)}
              className="px-3.5 py-2 bg-secondary text-on-secondary-container font-bold rounded-xl flex items-center gap-1.5 shadow"
            >
              <Unlock className="w-4 h-4" /> Obnovit Aktivitu
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Collapsible Sticky Job Header Card */}
      <div className="sticky top-16 z-40">
        <div
          className={`bg-card-bg rounded-2xl border transition-all duration-300 shadow-lg ${
            shouldCollapse
              ? 'p-2.5 bg-card-bg/95 backdrop-blur-md border-primary/60 ring-1 ring-primary/30'
              : 'p-4 border-outline-variant'
          }`}
        >
          {shouldCollapse ? (
            /* COLLAPSED COMPACT HEADER */
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h2 className="text-base font-bold text-on-surface truncate">{currentJob.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 shadow-sm ${
                    isModeDerigging ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'
                  }`}
                >
                  {isModeDerigging ? '🚛 DERIG' : '📦 NAKLÁDKA'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isArchived && (
                  <button
                    onClick={toggleJobMode}
                    className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-mono font-bold text-primary flex items-center gap-1 transition-colors"
                    title="Přepnout režim (Nakládka / Derigging)"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isModeDerigging ? 'Nakládka' : 'Derigging'}</span>
                  </button>
                )}

                <button
                  onClick={() => setManualCollapse(false)}
                  className="p-1.5 text-primary hover:bg-surface-container rounded-lg border border-outline-variant transition-colors flex items-center gap-1 text-xs font-mono font-bold"
                  title="Rozbalit plné detaily zakázky"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* EXPANDED FULL HEADER */
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap justify-between items-start gap-3 border-b border-outline-variant/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-on-surface">{currentJob.name}</h1>
                    {isArchived && (
                      <span className="px-2.5 py-0.5 bg-surface-variant text-outline font-mono text-xs font-bold rounded">
                        ARCHIVÁNO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-outline mt-0.5">Klient: {currentJob.client} • Gaffer: {currentJob.assignedGaffer}</p>

                  {/* Rigging & Derigging Dates */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-mono text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-secondary" /> Rigging: <strong>{currentJob.riggingDate || currentJob.date}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-tertiary" /> Derigging: <strong>{currentJob.deriggingDate || currentJob.date}</strong>
                    </span>
                    {!isArchived && (
                      <button
                        onClick={() => setEditingJob(currentJob)}
                        className="text-primary hover:underline font-normal text-[11px]"
                      >
                        (Upravit data)
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isArchived && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Chcete dokončit a uzamknout zakázku "${currentJob.name}"?`)) {
                          finishJob(currentJob.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-surface-container hover:bg-error-container/20 border border-outline-variant hover:border-error/40 text-outline hover:text-error text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                      title="Ukončit zakázku a přesunout do archivu"
                    >
                      <Lock className="w-3.5 h-3.5" /> Ukončit
                    </button>
                  )}

                  <button
                    onClick={() => setManualCollapse(true)}
                    className="p-1.5 text-outline hover:text-on-surface rounded-lg border border-outline-variant"
                    title="Sbalit na kompaktní lištu"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* High-Contrast Segmented Mode Switcher */}
              {!isArchived && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold text-outline uppercase tracking-wider">
                    PRVNÍ / DRUHÁ FÁZE REALIZACE (REŽIM)
                  </span>
                  <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant gap-1">
                    <button
                      onClick={() => isModeDerigging && toggleJobMode()}
                      className={`flex-1 py-2.5 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        !isModeDerigging
                          ? 'bg-secondary text-on-secondary-container shadow border border-secondary'
                          : 'text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      <Package className="w-4 h-4" /> 1. REŽIM NAKLÁDKA (Ze skladu)
                    </button>

                    <button
                      onClick={() => !isModeDerigging && toggleJobMode()}
                      className={`flex-1 py-2.5 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        isModeDerigging
                          ? 'bg-tertiary-container text-on-tertiary-container shadow border border-tertiary'
                          : 'text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      <Truck className="w-4 h-4" /> 2. REŽIM DERIGGING (Vracení)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Search & Barcode Scanner */}
      <div className="sticky top-[120px] z-30 bg-background/95 backdrop-blur-md py-2 flex flex-col gap-3 -mx-4 px-4 border-b border-outline-variant/60 transition-all">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat techniku, kábel, SN..."
              className="w-full h-12 pl-11 pr-4 bg-surface-container border border-outline-variant rounded-xl text-on-surface text-sm focus:border-primary focus:outline-none transition-all placeholder:text-outline"
            />
          </div>

          {/* Barcode Scanner CTA */}
          <button
            onClick={() => setIsScannerModalOpen(true)}
            disabled={isArchived}
            className="h-12 px-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary rounded-xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            title="Skenovat čárový/QR kód"
          >
            <QrCode className="w-5 h-5 text-secondary" />
            <span className="hidden sm:inline">SKENER</span>
          </button>
        </div>

        {/* Status Filter Horizontal Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              selectedStatusFilter === 'ALL'
                ? 'bg-primary text-on-primary-container border-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            Vše ({totalCount})
          </button>
          <button
            onClick={() => setSelectedStatusFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              selectedStatusFilter === 'PENDING'
                ? 'bg-primary text-on-primary-container border-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            K naložení ({pendingCount})
          </button>
          <button
            onClick={() => setSelectedStatusFilter('LOADED')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
              selectedStatusFilter === 'LOADED'
                ? 'bg-secondary text-on-secondary-container border-secondary shadow-sm'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            Na place ({loadedCount})
          </button>
          <button
            onClick={() => setSelectedStatusFilter('PACKED')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
              selectedStatusFilter === 'PACKED'
                ? 'bg-tertiary-container text-on-tertiary-container border-tertiary shadow-sm'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            K odvozu ({packedCount})
          </button>
          <button
            onClick={() => setSelectedStatusFilter('DAMAGED')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
              selectedStatusFilter === 'DAMAGED'
                ? 'bg-error-container text-on-error-container border-error shadow-sm'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-error"></span>
            Poškozeno ({damagedCount})
          </button>
        </div>
      </div>

      {/* Quick Add Buttons */}
      {!isArchived && (
        <div className="flex gap-2">
          <button
            onClick={() => setIsAdHocModalOpen(true)}
            className="flex-1 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-semibold text-primary flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 text-secondary" /> + Ad-Hoc Položka
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className="flex-1 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-semibold text-primary flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-primary" /> Přidat z Katalogu
          </button>
        </div>
      )}

      {/* Item List */}
      <div className="flex flex-col gap-3">
        {filteredItems.length === 0 ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-outline">
            Žádné položky neodpovídají zadanému filtru.
          </div>
        ) : (
          filteredItems.map((item) => (
            <ItemSwipeCard
              key={item.id}
              item={item}
            />
          ))
        )}
      </div>
    </div>
  );
};
