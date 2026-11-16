import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { getCategoryMeta, getItemMeta, FILTER_CATEGORIES, filterIdOf } from '../../utils/categoryIcons';
import { matchesSearch, SEARCH_INPUT_PROPS } from '../../domain/search';
import {
  Search, Plus, Layers, Check, FolderOpen, ArrowRight, Edit3, Trash2, X,
  EyeOff, Eye, Package, MoreVertical, QrCode,
} from 'lucide-react';
import { CatalogItemDrawer } from './CatalogItemDrawer';
import { useDialogs, Sheet, SheetAction } from '../common/Dialogs';
import { SheetButtons } from '../common/FormField';
import { ScannerScreen } from '../common/ScannerScreen';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { resolveCode } from '../../domain/labels-qr';
import { plural } from '../../domain/labels';

// ─────────────────────────────────────────────────────────────────────
// CATALOG ROW — one item per line on phones: big "add" button on the right,
// admin actions behind ⋮ (no edit / delete next to each other).
// ─────────────────────────────────────────────────────────────────────
const CatalogCard = ({ item, isAlreadyInJob, onAdd, onMenu, onOpenBundle }) => {
  const { isAdmin } = useInventory();
  const catMeta = getItemMeta(item);
  const CatIcon = catMeta.icon;
  const specs = [item.brand, item.power, item.weight, item.size].filter(Boolean).join(' · ');

  return (
    <div className={`bg-card-bg rounded-2xl border flex items-center gap-3 p-3 shadow-sm ${isAlreadyInJob ? 'border-secondary/50' : 'border-outline-variant'}`}>
      <span className={`p-2.5 rounded-xl border shrink-0 ${catMeta.color}`} title={catMeta.label}>
        <CatIcon className="w-6 h-6" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-base text-on-surface leading-snug break-words">{item.name}</h3>
        {specs && <p className="text-sm text-on-surface-variant truncate">{specs}</p>}
        {(item.isBundle || isAlreadyInJob) && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {isAlreadyInJob && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                <Check className="w-4 h-4" /> V zakázce
              </span>
            )}
            {item.isBundle && (
              <button
                onClick={() => onOpenBundle(item)}
                className="inline-flex items-center gap-1 h-8 px-2 -my-1 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold border border-primary/40"
              >
                <Layers className="w-4 h-4" /> Set · {item.bundleItems?.length || 0} dílů
              </button>
            )}
          </div>
        )}
      </div>

      {isAdmin() && (
        <button
          onClick={() => onMenu(item)}
          aria-label={`Možnosti: ${item.name}`}
          className="w-11 h-12 -mx-1 shrink-0 rounded-xl flex items-center justify-center text-on-surface-variant active:scale-90"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      )}
      <button
        onClick={() => onAdd(item)}
        aria-label={`${isAlreadyInJob ? 'Přidat znovu' : 'Přidat do zakázky'}: ${item.name}`}
        className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center active:scale-90 ${
          isAlreadyInJob ? 'bg-secondary/10 border border-secondary/50 text-secondary' : 'bg-secondary text-on-secondary shadow-sm'
        }`}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// BUNDLE SHEET — what a set contains
// ─────────────────────────────────────────────────────────────────────
const BundleModal = ({ item, onClose, onAdd }) => {
  if (!item) return null;
  return (
    <Sheet
      title={item.name}
      subtitle="Složení setu"
      onClose={onClose}
      footer={<SheetButtons onCancel={onClose} cancelLabel="Zavřít" onSubmit={() => { onAdd(item); onClose(); }} submitLabel="Vložit set" icon={Plus} tone="secondary" />}
    >
      <ul className="flex flex-col gap-1.5">
        {item.bundleItems?.map((sub, i) => (
          <li key={i} className="flex justify-between items-center gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant text-base">
            <span className="text-on-surface font-medium min-w-0 break-words">{sub.name}</span>
            <span className="font-mono font-bold text-primary shrink-0">{sub.qty} ks</span>
          </li>
        ))}
      </ul>
    </Sheet>
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
    stockUnits,
  } = useInventory();
  const { confirm, toast } = useDialogs();

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(false);
  const [activeBundleModal, setActiveBundleModal] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);   // null | 'NEW' | catalogItem
  const [menuItem, setMenuItem] = useState(null); // admin actions (⋮) for one item
  const [scanning, setScanning] = useState(false);

  const scrollRef = useRef(null);

  const addedCatalogIds = new Set(jobItems.map(i => i.catalogId).filter(Boolean));

  const searching = searchQuery.trim() !== '';
  const nameHit = (item) => matchesSearch(item.name, searchQuery);
  const filteredCatalog = catalog.filter((item) => {
    if (hideAlreadyAdded && addedCatalogIds.has(item.id)) return false;
    // While searching, look through every category so a found item is never hidden by the chip.
    if (searching) return matchesSearch([item.name, item.category, getCategoryMeta(item.category).label, item.brand, item.usage, item.size], searchQuery);
    return selectedCategory === 'ALL' || filterIdOf(item) === selectedCategory;
  });
  // Items found by their name come first; matches in brand / usage / size follow.
  if (searching) filteredCatalog.sort((a, b) => nameHit(b) - nameHit(a));

  const handleAdd = (item) => {
    if (!currentJob || currentJob.status !== 'ACTIVE') {
      toast({ text: 'Nejdřív vyberte nebo založte aktivní zakázku.' });
      return;
    }
    addCatalogItemToJob(item);
    if (navigator.vibrate) navigator.vibrate(30);
    toast({ text: `Přidáno: ${item.name}`, actionLabel: 'Zobrazit', onAction: () => setActiveTab('packing') });
  };

  const itemByCode = (code) => {
    const r = resolveCode(code, { jobItems: [], catalog, units: stockUnits });
    return r.kind === 'UNIT' ? catalog.find((c) => c.id === r.unit.catalogId) : r.kind === 'CATALOG' ? r.catalogItem : null;
  };
  /** Show just the scanned item in the list (clears the other filters so it cannot stay hidden). */
  const showItem = (item) => { setSelectedCategory('ALL'); setHideAlreadyAdded(false); setSearchQuery(item.name); };

  // Hardware barcode reader: scanning a label / EAN adds the item to the selected job.
  useBarcodeScanner((code) => {
    const item = itemByCode(code);
    if (!item) { toast({ text: `✗ Neznámý kód ${code}` }); return; }
    if (!currentJob || currentJob.status === 'ARCHIVED') { showItem(item); return; }
    handleAdd(item);
  }, { enabled: !drawerItem && !scanning });

  // Camera scanner (button next to the search field): find the item, then choose what to do with it.
  const onCameraCode = (code) => {
    const item = itemByCode(code);
    if (!item) return { type: 'error', text: 'Neznámý kód', detail: code };
    const canAdd = currentJob?.status === 'ACTIVE';
    return {
      type: 'ask',
      text: item.name,
      detail: canAdd ? `Přidat do zakázky ${currentJob.name}?` : 'Není vybraná aktivní zakázka.',
      actions: [
        ...(canAdd ? [{
          label: 'Přidat do zakázky (+1 ks)',
          icon: Plus,
          keepOpen: true,
          onClick: () => { addCatalogItemToJob(item); return { type: 'success', text: `Přidáno: ${item.name}`, detail: currentJob.name }; },
        }] : []),
        { label: 'Najít v katalogu', icon: Search, onClick: () => showItem(item) },
      ],
    };
  };

  const handleDelete = async (itemId, itemName) => {
    if (await confirm({
      title: `Smazat „${itemName}“ z katalogu?`,
      message: 'Položka zmizí z katalogu pro celý tým. Zakázky, které ji už obsahují, zůstanou beze změny.',
      confirmLabel: 'Smazat z katalogu',
      danger: true,
    })) {
      deleteCatalogItem(itemId);
    }
  };

  const chooseCategory = (id) => { setSelectedCategory(id); setSearchQuery(''); };
  const activeJob = currentJob?.status === 'ACTIVE' ? currentJob : null;
  const chip = (active) => `h-11 px-4 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 border flex items-center gap-1.5 ${
    active ? 'bg-primary text-on-primary border-primary' : 'bg-card-bg text-on-surface-variant border-outline-variant'
  }`;

  return (
    <div className="max-w-4xl mx-auto px-3 pt-3 pb-32 flex flex-col gap-3">

      {/* ── Which job the + button adds to (the job itself is chosen in the top bar) ── */}
      {activeJob ? (
        <button
          onClick={() => setActiveTab('packing')}
          className="min-h-[48px] px-3 py-2 bg-card-bg border border-outline-variant rounded-xl flex items-center gap-2 text-left active:scale-[0.99]"
        >
          <FolderOpen className="w-5 h-5 text-primary shrink-0" />
          <span className="flex-1 min-w-0 text-sm text-on-surface-variant truncate">
            Přidáváte do <strong className="text-on-surface">{activeJob.name}</strong>
          </span>
          <span className="text-sm font-semibold text-secondary flex items-center gap-1 shrink-0">Balení <ArrowRight className="w-4 h-4" /></span>
        </button>
      ) : (
        <button
          onClick={() => setActiveTab('dashboard')}
          className="min-h-[48px] px-3 py-2 bg-amber-500/15 border border-amber-500/50 rounded-xl flex items-center gap-2 text-left text-sm font-semibold text-on-surface"
        >
          <FolderOpen className="w-5 h-5 shrink-0" />
          <span className="flex-1">Pro přidávání techniky nejdřív vyberte aktivní zakázku.</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      )}

      {/* ── Search + hide toggle ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat nebo načíst kód…"
            {...SEARCH_INPUT_PROPS}
            className="w-full h-12 pl-10 pr-11 bg-card-bg border border-outline-variant rounded-xl text-on-surface text-base focus:border-primary focus:outline-none placeholder:text-outline"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label="Vymazat hledání" className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-outline">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <button onClick={() => setScanning(true)} aria-label="Najít položku načtením kódu"
          className="w-12 h-12 rounded-xl border border-outline-variant bg-card-bg flex items-center justify-center shrink-0 active:scale-90">
          <QrCode className="w-6 h-6 text-secondary" />
        </button>
        <button
          onClick={() => setHideAlreadyAdded(!hideAlreadyAdded)}
          aria-pressed={hideAlreadyAdded}
          aria-label={hideAlreadyAdded ? 'Položky už přidané do zakázky jsou skryté' : 'Skrýt položky už přidané do zakázky'}
          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 active:scale-90 ${
            hideAlreadyAdded ? 'bg-primary-container border-primary text-on-primary-container' : 'bg-card-bg border-outline-variant text-on-surface-variant'
          }`}
        >
          {hideAlreadyAdded ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
        {isAdmin() && (
          <button
            onClick={() => setDrawerItem('NEW')}
            aria-label="Nová položka katalogu"
            className="h-12 px-3 rounded-xl bg-card-bg border border-outline-variant text-on-surface font-semibold text-sm flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <Plus className="w-5 h-5 text-secondary" /> <span className="hidden xs:inline">Nová</span>
          </button>
        )}
      </div>

      {/* ── Category chips ── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3">
        <button onClick={() => chooseCategory('ALL')} aria-pressed={!searching && selectedCategory === 'ALL'} className={chip(!searching && selectedCategory === 'ALL')}>
          Vše <span className="font-mono text-xs opacity-80">{catalog.length}</span>
        </button>
        {FILTER_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = !searching && selectedCategory === cat.id;
          const count = catalog.filter((i) => filterIdOf(i) === cat.id).length;
          if (count === 0) return null;
          return (
            <button key={cat.id} onClick={() => chooseCategory(cat.id)} aria-pressed={isSelected} className={chip(isSelected)}>
              <Icon className="w-4 h-4" />
              {cat.label} <span className="font-mono text-xs opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Catalog list ── */}
      {catalog.length === 0 ? (
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center gap-3">
          <Package className="w-10 h-10 text-outline/40" />
          <p className="text-base">Katalog techniky je prázdný.{isAdmin() ? ' Přidejte první položku tlačítkem Nová.' : ''}</p>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center gap-3">
          <Package className="w-10 h-10 text-outline/40" />
          <p className="text-base">
            {searchQuery
              ? `Nic neodpovídá „${searchQuery}“.`
              : hideAlreadyAdded && addedCatalogIds.size > 0
              ? 'Všechny položky už jsou v zakázce.'
              : 'V této kategorii nic není.'}
          </p>
          {hideAlreadyAdded && addedCatalogIds.size > 0 && (
            <button onClick={() => setHideAlreadyAdded(false)} className="h-11 px-4 rounded-xl border border-outline-variant text-primary text-base font-semibold">
              Zobrazit vše
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredCatalog.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              isAlreadyInJob={addedCatalogIds.has(item.id)}
              onAdd={handleAdd}
              onMenu={setMenuItem}
              onOpenBundle={setActiveBundleModal}
            />
          ))}
        </div>
      )}

      {/* ── Admin actions for one item ── */}
      {menuItem && (
        <Sheet title={menuItem.name} subtitle="Položka katalogu" onClose={() => setMenuItem(null)}>
          <SheetAction icon={Edit3} label="Upravit položku" onClick={() => { setDrawerItem(menuItem); setMenuItem(null); }} />
          <SheetAction icon={Trash2} label="Smazat z katalogu" danger onClick={() => { const it = menuItem; setMenuItem(null); handleDelete(it.id, it.name); }} />
        </Sheet>
      )}

      {scanning && (
        <ScannerScreen
          title="Skener · katalog"
          subtitle={activeJob ? `Zakázka: ${activeJob.name}` : 'Bez zakázky – jen hledání'}
          onClose={() => setScanning(false)}
          onCode={onCameraCode}
        />
      )}

      {/* ── Bundle sheet ── */}
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
