import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { FolderOpen, Edit2, Copy, FileText, Lock, Unlock, Image as ImageIcon, AlertTriangle, Trash2, Plus, Check, RefreshCw, X, Hash } from 'lucide-react';

export const ContextMenuModal = () => {
  const {
    contextMenu,
    setContextMenu,
    setCurrentJobId,
    setActiveTab,
    setEditingJob,
    setTemplateJob,
    setIsProtocolModalOpen,
    finishJob,
    reactivateJob,
    deleteJobItem,
    deleteJob,
    setDamageReportItem,

    addCatalogItemToJob,
    setIsMasterCatalogModalOpen,
    deleteCatalogItem,
    updateConsumableState,
    setItemExactQuantity,
  } = useInventory();

  if (!contextMenu) return null;

  const { type, target } = contextMenu;

  const handleClose = () => setContextMenu(null);

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card-bg rounded-2xl border border-outline-variant max-w-sm w-full p-4 flex flex-col gap-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-outline-variant pb-2.5">
          <div className="truncate">
            <span className="text-[10px] font-mono font-bold text-primary uppercase">KONTEXTOVÉ MENU</span>
            <h3 className="text-base font-bold text-on-surface truncate">{target.name || 'Položka'}</h3>
          </div>
          <button onClick={handleClose} className="text-outline hover:text-on-surface p-1 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* JOB Context Menu */}
        {type === 'JOB' && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => {
                setCurrentJobId(target.id);
                setActiveTab('packing');
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <FolderOpen className="w-4 h-4 text-secondary" /> Otevřít Seznam Zakázky
            </button>

            <button
              onClick={() => {
                setEditingJob(target);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-primary" /> Upravit Název a Data Zakázky
            </button>

            <button
              onClick={() => {
                setTemplateJob(target);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-4 h-4 text-secondary" /> Použít jako vzor (Kopírovat)
            </button>

            <button
              onClick={() => {
                setCurrentJobId(target.id);
                setIsProtocolModalOpen(true);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <FileText className="w-4 h-4 text-tertiary" /> Vygenerovat PDF Protokol
            </button>

            {target.status === 'ARCHIVED' ? (
              <button
                onClick={() => {
                  reactivateJob(target.id);
                  handleClose();
                }}
                className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-primary flex items-center gap-2.5 transition-colors"
              >
                <Unlock className="w-4 h-4" /> Obnovit do Aktivního Stavuu
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm(`Chcete ukončit zakázku "${target.name}"?`)) {
                    finishJob(target.id);
                  }
                  handleClose();
                }}
                className="w-full px-3 py-2.5 bg-surface-container hover:bg-error-container/30 rounded-xl text-xs font-semibold text-error flex items-center gap-2.5 transition-colors"
              >
                <Lock className="w-4 h-4" /> Ukončit Zakázku (Archivovat)
              </button>
            )}

            {/* Permanent Delete for Admins */}
            <button
              onClick={() => {
                if (window.confirm(`OPRAVDU chcete trvale smazat zakázku "${target.name}" včetně všech jejích přiřazených položek?\nTato akce je nevratná.`)) {
                  deleteJob(target.id);
                  handleClose();
                }
              }}
              className="w-full px-3 py-2.5 bg-error-container/20 hover:bg-error-container/40 rounded-xl text-xs font-semibold text-error flex items-center gap-2.5 transition-colors border border-error/30 mt-1"
            >
              <Trash2 className="w-4 h-4" /> Trvale Smazat Zakázku
            </button>
          </div>
        )}


        {/* PACKING ITEM Context Menu */}
        {type === 'PACKING_ITEM' && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => {
                if (target.onOpenPhoto) target.onOpenPhoto(target);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-primary" /> Zobrazit Fotku a Parametry
            </button>

            <button
              onClick={() => {
                const val = prompt(`Zadejte přesný naložený počet kusů pro ${target.name} (0 - ${target.quantityRequested}):`, target.quantityLoaded);
                if (val !== null) {
                  const num = parseInt(val);
                  if (!isNaN(num)) {
                    setItemExactQuantity(target.id, num);
                  }
                }
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <Hash className="w-4 h-4 text-secondary" /> Ručně Zadat Počet Kusů
            </button>

            <button
              onClick={() => {
                setDamageReportItem(target);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-error-container/30 rounded-xl text-xs font-semibold text-error flex items-center gap-2.5 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" /> Hlášení Závady / Poškození
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Opravdu chcete odebrat ${target.name} ze zakázky?`)) {
                  deleteJobItem(target.id);
                }
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-error-container/30 rounded-xl text-xs font-semibold text-error flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Odebrats ze Zakázky
            </button>
          </div>
        )}

        {/* CATALOG ITEM Context Menu */}
        {type === 'CATALOG_ITEM' && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => {
                addCatalogItemToJob(target);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-secondary" /> Vložit do Cílové Zakázky
            </button>

            <button
              onClick={() => {
                setIsMasterCatalogModalOpen(true);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface flex items-center gap-2.5 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-primary" /> Upravit v Centrálním Katalogu
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Opravdu chcete smazat položku "${target.name}" z celého katalogu?`)) {
                  deleteCatalogItem(target.id);
                }
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-surface-container hover:bg-error-container/30 rounded-xl text-xs font-semibold text-error flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Smazat z Globálního Katalogu
            </button>
          </div>
        )}

        {/* CONSUMABLE Context Menu */}
        {type === 'CONSUMABLE' && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => {
                updateConsumableState(target.id, 0);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-secondary-container text-on-secondary-container rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors"
            >
              <Check className="w-4 h-4" /> Označit jako OK (100%)
            </button>

            <button
              onClick={() => {
                updateConsumableState(target.id, 1);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-tertiary-container text-on-tertiary-container rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" /> Označit jako 50% (Brzy doplnit)
            </button>

            <button
              onClick={() => {
                updateConsumableState(target.id, 2);
                handleClose();
              }}
              className="w-full px-3 py-2.5 bg-error-container text-on-error-container rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Označit jako REFILL (Koupit/Doplnit)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
