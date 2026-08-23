import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { getCategoryMeta, CATEGORIES } from '../../utils/categoryIcons';
import { ItemThumbnail } from '../common/ItemThumbnail';
import {
  Search, Plus, Layers, Zap, Weight, Check, Info,
  FolderOpen, ArrowRight, Edit3, Trash2, X, ChevronLeft,
  ChevronRight, Filter, EyeOff, Eye, Package
} from 'lucide-react';
import { CatalogItemDrawer } from './CatalogItemDrawer';

// ─────────────────────────────────────────────────────────────────────
// CATALOG CARD — compact, no "edit mode" concept
// Admin always sees Edit/Delete actions via a small action bar at bottom
// ─────────────────────────────────────────────────────────────────────
const CatalogCard = ({ item, isAlreadyInJob, currentJob, onAdd, onEdit, onDelete, onOpenBundle }) => {
  const { isAdmin } = useInventory();
  const catMeta = getCategoryMeta(item.category);
  const CatIcon = catMeta.icon;

  return (
    <div className={`bg-card-bg rounded-2xl overflow-hidden border flex flex-col shadow-sm transition-all hover:shadow-md ${
      isAlreadyInJob ? 'border-secondary/40' : 'border-outline-variant'
    }`}>
      {/* Image */}
      <div className="relative h-40 bg-surface-container-lowest flex items-center justify-center overflow-hidden">
        {item.isBundle && (
          <span className="absolute top-2.5 left-2.5 bg-primary-container text-on-primary-container px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold z-10 border border-primary/40 flex items-center gap-1">
            <Layers className="w-3 h-3" /> SET
          </span>
        )}
        {isAlreadyInJob && (
          <span className="absolute top-2.5 right-2.5 bg-secondary-container/80 text-on-secondary-container px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold z-10 border border-secondary/50 flex items-center gap-1 backdrop-blur-sm">
            <Check className="w-3 h-3 text-secondary" /> V zakázce
          </span>
        )}
        <ItemThumbnail src={item.image} name={item.name} category={item.category} className="w-full h-full" />
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-grow gap-2.5">
        {/* Name + category */}
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 p-1.5 rounded-lg border shrink-0 ${catMeta.color}`}>
            <CatIcon className="w-3.5 h-3.5" />
          </span>
          <h3 className="font-bold text-sm text-on-surface leading-snug">{item.name}</h3>
        </div>

        {/* Specs row */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant">
          <span className="flex items-center gap-1">
            <Weight className="w-3 h-3 text-outline" /> {item.weight}
          </span>
          <span className="w-px h-3 bg-outline-variant" />
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-tertiary" /> {item.power}
          </span>
          {item.isBundle && (
            <>
              <span className="w-px h-3 bg-outline-variant" />
              <button
                onClick={(e) => { e.stopPropagation(); onOpenBundle(item); }}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Info className="w-3 h-3" /> {item.bundleItems?.length} dílů
              </button>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Action row */}
        <div className="flex gap-2 mt-auto">
          {/* Primary CTA — Add to job */}
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(item); }}
            className={`flex-1 h-10 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              isAlreadyInJob
                ? 'bg-secondary/10 border border-secondary/40 text-secondary hover:bg-secondary/20'
                : 'bg-secondary text-on-secondary-container shadow-sm hover:opacity-90'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {isAlreadyInJob ? 'Přidat znovu' : 'Přidat'}
          </button>

          {/* Admin actions — always visible, no mode toggle */}
          {isAdmin() && (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                className="w-10 h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-primary flex items-center justify-center transition-all active:scale-90"
                title="Upravit položku v katalogu"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.name); }}
                className="w-10 h-10 rounded-xl border border-outline-variant bg-surface-container hover:bg-error-container/30 hover:border-error/40 text-outline hover:text-error flex items-center justify-center transition-all active:scale-90"
                title="Smazat z katalogu"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// BUNDLE MODAL — simple bottom sheet
// ─────────────────────────────────────────────────────────────────────
const BundleModal = ({ item, onClose, onAdd }) => {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card-bg rounded-t-3xl sm:rounded-2xl border border-outline-variant w-full sm:max-w-md p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono font-bold text-primary uppercase">Složení setu</span>
            <h3 className="text-lg font-bold text-on-surface mt-0.5">{item.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-outline hover:text-on-surface rounded-lg active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {item.bundleItems?.map((sub, i) => (
            <div key={i} className="flex justify-between items-center bg-surface-container p-3 rounded-xl border border-outline-variant text-sm">
              <span className="text-on-surface font-medium">{sub.name}</span>
              <span className="font-mono font-bold text-primary">{sub.qty} ks</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm active:scale-95">
            Zavřít
          </button>
          <button
            onClick={() => { onAdd(item); onClose(); }}
            className="flex-1 py-3 bg-secondary text-on-secondary-container font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow active:scale-95"
          >
            <Plus className="w-4 h-4" /> Vložit set
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MAIN EQUIPMENT CATALOG
// ─────────────────────────────────────────────────────────────────────
export const EquipmentCatalog = () => {
  const {
    catalog,
    addCatalogItemToJob,
    currentJob,
    jobItems,
    jobs,
    setCurrentJobId,
    setActiveTab,
    deleteCatalogItem,
    isAdmin,
  } = useInventory();

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(false);
  const [activeBundleModal, setActiveBundleModal] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);   // null | 'NEW' | catalogItem
  const [addedItemSuccess, setAddedItemSuccess] = useState(null);

  const scrollRef = useRef(null);

  const addedCatalogIds = new Set(jobItems.map(i => i.catalogId).filter(Boolean));

  const filteredCatalog = catalog.filter((item) => {
    if (selectedCategory !== 'ALL') {
      const meta = getCategoryMeta(item.category);
      if (meta.id !== selectedCategory && item.category !== selectedCategory) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return false;
    }
    if (hideAlreadyAdded && addedCatalogIds.has(item.id)) return false;
    return true;
  });

  const handleAdd = (item) => {
    if (!currentJob) return;
    addCatalogItemToJob(item);
    setAddedItemSuccess(item.name);
    setTimeout(() => setAddedItemSuccess(null), 2500);
  };

  const handleDelete = (itemId, itemName) => {
    if (window.confirm(`Opravdu smazat „${itemName}" z celého katalogu?`)) {
      deleteCatalogItem(itemId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-4">

      {/* ── Job selector banner ── */}
      <div className="bg-card-bg border border-outline-variant rounded-2xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2 bg-primary-container text-on-primary-container rounded-xl shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider block">
              Přidávat do zakázky (pouze aktivní)
            </span>
            <select
              value={currentJob?.id || ''}
              onChange={(e) => setCurrentJobId(e.target.value)}
              className="w-full bg-transparent text-on-surface font-bold text-sm focus:outline-none cursor-pointer truncate mt-0.5 border-none"
            >
              {jobs.filter(j => j.status === 'ACTIVE').map((j) => (
                <option key={j.id} value={j.id} className="bg-surface-container text-on-surface font-semibold">
                  {j.name} ({j.client})
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentJob && (
          <button
            onClick={() => setActiveTab('packing')}
            className="w-full sm:w-auto px-3 py-2 bg-secondary/10 border border-secondary/40 text-secondary font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
          >
            <span>Packing list</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Header row ── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-on-surface">Katalog techniky</h1>
          <p className="text-xs text-outline mt-0.5">
            {catalog.length} položek {isAdmin() && '· Klikněte ✏ pro úpravu'}
          </p>
        </div>
        {isAdmin() && (
          <button
            onClick={() => setDrawerItem('NEW')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-secondary text-on-secondary-container font-bold text-sm rounded-2xl shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Nová položka</span>
          </button>
        )}
      </div>

      {/* ── Success toast ── */}
      {addedItemSuccess && (
        <div className="bg-secondary-container/20 border border-secondary/40 text-secondary p-3 rounded-xl font-semibold text-sm flex items-center justify-between gap-2 animate-pulse">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" /> {addedItemSuccess} přidáno do <strong>{currentJob?.name}</strong>
          </span>
          <button onClick={() => setActiveTab('packing')} className="text-xs underline opacity-80 hover:opacity-100 shrink-0">
            Zobrazit →
          </button>
        </div>
      )}

      {/* ── Search + hide toggle ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat techniku..."
            className="w-full h-11 pl-9 pr-9 bg-surface-container border border-outline-variant rounded-xl text-on-surface text-sm focus:border-primary focus:outline-none placeholder:text-outline"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setHideAlreadyAdded(!hideAlreadyAdded)}
          className={`h-11 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 active:scale-90 ${
            hideAlreadyAdded
              ? 'bg-primary-container/30 border-primary/40 text-primary'
              : 'bg-surface-container border-outline-variant text-outline'
          }`}
          title={hideAlreadyAdded ? 'Skryty již přidané — kliknout pro zobrazení' : 'Zobrazeny všechny — kliknout pro skrytí přidaných'}
        >
          {hideAlreadyAdded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="hidden xs:inline">{hideAlreadyAdded ? 'Skryty' : 'Vše'}</span>
        </button>
      </div>

      {/* ── Category pills ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-bold whitespace-nowrap shrink-0 border transition-all ${
            selectedCategory === 'ALL'
              ? 'bg-primary text-on-primary-container border-primary'
              : 'bg-surface-container text-on-surface-variant border-outline-variant'
          }`}
        >
          Vše ({catalog.length})
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          const count = catalog.filter(i => {
            const m = getCategoryMeta(i.category);
            return m.id === cat.id || i.category === cat.id;
          }).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 border transition-all ${
                isSelected
                  ? 'bg-primary-container text-on-primary-container border-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant'
              }`}
            >
              <Icon className="w-3 h-3" />
              {cat.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Catalog grid ── */}
      {filteredCatalog.length === 0 ? (
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-10 text-center text-outline flex flex-col items-center gap-3">
          <Package className="w-10 h-10 text-outline/40" />
          <p className="text-sm">
            {searchQuery
              ? `Žádná shoda pro „${searchQuery}"`
              : hideAlreadyAdded && addedCatalogIds.size > 0
              ? 'Všechny položky jsou již v zakázce.'
              : 'Katalog je prázdný.'}
          </p>
          {hideAlreadyAdded && addedCatalogIds.size > 0 && (
            <button
              onClick={() => setHideAlreadyAdded(false)}
              className="text-primary text-sm font-semibold hover:underline"
            >
              Zobrazit vše →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredCatalog.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              isAlreadyInJob={addedCatalogIds.has(item.id)}
              currentJob={currentJob}
              onAdd={handleAdd}
              onEdit={(item) => setDrawerItem(item)}
              onDelete={handleDelete}
              onOpenBundle={setActiveBundleModal}
            />
          ))}
        </div>
      )}

      {/* ── Bundle modal ── */}
      <BundleModal
        item={activeBundleModal}
        onClose={() => setActiveBundleModal(null)}
        onAdd={handleAdd}
      />

      {/* ── Catalog item drawer (create/edit) ── */}
      <CatalogItemDrawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
      />
    </div>
  );
};
