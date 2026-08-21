import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { CATEGORIES, getCategoryMeta } from '../../utils/categoryIcons';
import { ItemThumbnail } from '../common/ItemThumbnail';
import { Search, Plus, Layers, Zap, Weight, Check, Info, FolderOpen, ArrowRight, Settings, Eye, EyeOff, MoreVertical, Edit3, Trash2, Edit2, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const CatalogCardItem = ({ item, isAlreadyInJob, currentJob, isEditMode, onAdd, onOpenBundle, onEdit, onDelete }) => {
  const { setContextMenu } = useInventory();
  const catMeta = getCategoryMeta(item.category);
  const CatIcon = catMeta.icon;

  const longPressProps = useLongPress(
    (e) => {
      e.stopPropagation();
      setContextMenu({ type: 'CATALOG_ITEM', target: item });
    },
    null
  );

  return (
    <div
      {...longPressProps}
      className={`bg-card-bg rounded-2xl overflow-hidden border transition-all flex flex-col group shadow-md relative select-none ${
        isEditMode
          ? 'border-amber-500/80 ring-1 ring-amber-500/40 bg-amber-950/10'
          : 'border-outline-variant hover:border-outline'
      }`}
    >
      {/* Image Container */}
      <div className="h-44 relative bg-surface-container-lowest p-4 flex items-center justify-center overflow-hidden">
        {item.isBundle && (
          <span className="absolute top-3 left-3 bg-primary-container text-on-primary-container px-2.5 py-1 rounded font-mono text-[11px] font-bold z-10 border border-primary/40 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> BALÍČEK / SET
          </span>
        )}
        {!isEditMode && isAlreadyInJob && (
          <span className="absolute top-3 right-3 bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded font-mono text-[11px] font-bold z-10 border border-secondary flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-secondary" /> JIŽ V ZAKÁZCE
          </span>
        )}

        {/* Quick Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu({ type: 'CATALOG_ITEM', target: item });
          }}
          className="absolute top-3 left-3 z-10 p-1.5 bg-card-bg/80 backdrop-blur text-outline hover:text-on-surface rounded-lg border border-outline-variant"
          title="Kontextové menu"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <ItemThumbnail
          src={item.image}
          name={item.name}
          category={item.category}
          className="w-full h-full"
        />
      </div>

      {/* Content Details */}
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex items-center gap-2 mb-2">
          <span className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${catMeta.color}`} title={catMeta.label}>
            <CatIcon className="w-4 h-4" />
          </span>
          <h3 className="font-bold text-lg text-on-surface leading-snug">{item.name}</h3>
        </div>

        {/* Specs Grid */}
        <div className="flex gap-4 mb-4 text-xs font-mono text-on-surface-variant">
          <div className="flex flex-col">
            <span className="text-outline text-[10px]">HMOTNOST</span>
            <span className="flex items-center gap-1 font-semibold">
              <Weight className="w-3 h-3 text-outline" /> {item.weight}
            </span>
          </div>
          <div className="w-[1px] bg-outline-variant"></div>
          <div className="flex flex-col">
            <span className="text-outline text-[10px]">VÝKON</span>
            <span className="flex items-center gap-1 font-semibold">
              <Zap className="w-3 h-3 text-tertiary" /> {item.power}
            </span>
          </div>
        </div>

        {/* Bundle preview button if bundle */}
        {item.isBundle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenBundle(item);
            }}
            className="mb-3 text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
          >
            <Info className="w-3.5 h-3.5" /> Zobrazit složení balíčku ({item.bundleItems?.length} položek)
          </button>
        )}

        {/* Edit Mode Buttons vs Normal Add Button */}
        {isEditMode ? (
          <div className="mt-auto flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="flex-1 h-10 bg-primary text-on-primary-container font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow"
            >
              <Edit2 className="w-3.5 h-3.5" /> Upravit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id, item.name);
              }}
              className="h-10 px-3 bg-error-container/30 border border-error/40 text-error font-bold text-xs rounded-xl flex items-center justify-center transition-colors"
              title="Smazat z katalogu"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd(item);
            }}
            className="mt-auto h-11 w-full bg-surface-container-high hover:bg-surface-bright border border-outline-variant text-primary font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 text-secondary" />
            {item.isBundle ? `Vložit set do ${currentJob?.name || 'zakázky'}` : `Přidat do ${currentJob?.name || 'zakázky'}`}
          </button>
        )}
      </div>
    </div>
  );
};

export const EquipmentCatalog = () => {
  const {
    catalog,
    addCatalogItemToJob,
    currentJob,
    jobItems,
    jobs,
    setCurrentJobId,
    setActiveTab,
    setIsMasterCatalogModalOpen,
    deleteCatalogItem,
    isAdmin
  } = useInventory();

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAlreadyAdded, setHideAlreadyAdded] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBundleModal, setActiveBundleModal] = useState(null);
  const [addedItemSuccess, setAddedItemSuccess] = useState(null);

  const scrollRef = useRef(null);

  const addedCatalogIds = new Set(jobItems.map(i => i.catalogId).filter(Boolean));

  const filteredCatalog = catalog.filter((item) => {
    if (selectedCategory !== 'ALL') {
      const meta = getCategoryMeta(item.category);
      if (meta.id !== selectedCategory && item.category !== selectedCategory) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (!isEditMode && hideAlreadyAdded && addedCatalogIds.has(item.id)) {
      return false;
    }
    return true;
  });

  const handleAdd = (item) => {
    if (!currentJob) return;
    addCatalogItemToJob(item);
    setAddedItemSuccess(item.name);
    setTimeout(() => setAddedItemSuccess(null), 2500);
  };

  const handleEditItem = (item) => {
    setIsMasterCatalogModalOpen(true);
  };

  const handleDeleteItem = (itemId, itemName) => {
    if (window.confirm(`Opravdu chcete smazat položku "${itemName}" z celého katalogu techniky?`)) {
      deleteCatalogItem(itemId);
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6 pb-28">
      {/* Responsive Target Active Job Banner */}
      {!isEditMode && (
        <div className="bg-card-bg border-2 border-primary/60 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2.5 bg-primary-container text-on-primary-container rounded-xl shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider block">
                CÍLOVÁ ZAKÁZKA PRO PŘIDÁVÁNÍ
              </span>
              <select
                value={currentJob?.id || ''}
                onChange={(e) => setCurrentJobId(e.target.value)}
                className="w-full sm:w-auto max-w-full bg-surface-container text-on-surface font-bold text-sm sm:text-base rounded-lg px-2 py-1 focus:outline-none border border-outline-variant cursor-pointer truncate mt-0.5"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.client})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentJob && (
            <button
              onClick={() => setActiveTab('packing')}
              className="w-full sm:w-auto px-3.5 py-2 bg-secondary text-on-secondary-container font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90 transition-all active:scale-95 shadow shrink-0"
            >
              <span>Zobrazit Seznam Zakázky</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Header & Edit Mode Toggle Icon */}
      <div className="flex justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Katalog Filmové Techniky</h1>
            {isEditMode && (
              <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-mono text-xs font-bold rounded-full animate-pulse">
                EDITAČNÍ REŽIM
              </span>
            )}
          </div>
          <p className="text-sm text-outline">
            {isEditMode ? 'Režim úprav a správy centrálního katalogu techniky' : 'Vyberte techniku ze seznamu a vložte ji do zakázky'}
          </p>
        </div>

        {isAdmin() && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-2.5 rounded-xl border transition-all shadow-md active:scale-95 flex items-center gap-2 ${
              isEditMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-surface-container hover:bg-surface-container-high border-outline-variant text-primary'
            }`}
            title={isEditMode ? 'Ukončit editační režim katalogu' : 'Vstoupit do editačního režimu katalogu'}
          >
            {isEditMode ? <X className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            <span className="hidden sm:inline font-mono text-xs font-bold">
              {isEditMode ? 'Ukončit Editaci' : 'Editační Režim (Admin)'}
            </span>
          </button>
        )}
      </div>

      {/* Edit Mode Banner & Create CTA */}
      {isEditMode && isAdmin() && (
        <div className="bg-amber-950/20 border-2 border-amber-500/60 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-sm font-bold text-amber-300">Jste v editačním režimu katalogu</strong>
              <span className="text-xs text-outline">Můžete přímo upravovat položky, jejich parametry, fotky i složení setů.</span>
            </div>
          </div>

          <button
            onClick={() => setIsMasterCatalogModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow hover:opacity-90 shrink-0"
          >
            <Plus className="w-4 h-4" /> + Vytvořit Novou Položku
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {!isEditMode && addedItemSuccess && (
        <div className="bg-secondary-container text-on-secondary-container p-3.5 rounded-xl font-bold text-xs flex items-center justify-between shadow-lg border border-secondary animate-pulse">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-secondary" /> {addedItemSuccess} úspěšně přidáno do zakázky <strong>{currentJob?.name}</strong>!
          </span>
          <button
            onClick={() => setActiveTab('packing')}
            className="underline text-xs hover:opacity-80"
          >
            Zobrazit v zakázce
          </button>
        </div>
      )}

      {/* Search Bar & Hide Already Added Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat podle názvu techniky..."
            className="w-full h-12 pl-11 pr-4 bg-surface-container border border-outline-variant rounded-xl text-on-surface text-sm focus:border-primary focus:outline-none placeholder:text-outline"
          />
        </div>

        {!isEditMode && (
          <button
            onClick={() => setHideAlreadyAdded(!hideAlreadyAdded)}
            className={`h-12 px-4 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all shrink-0 ${
              hideAlreadyAdded
                ? 'bg-primary-container/30 text-on-primary-container border-primary/40'
                : 'bg-surface-container text-outline border-outline-variant'
            }`}
          >
            {hideAlreadyAdded ? <EyeOff className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4 text-outline" />}
            <span>{hideAlreadyAdded ? 'Skryty již přidané' : 'Zobrazeny všechny'}</span>
          </button>
        )}
      </div>

      {/* Responsive Category Selector & Scroll Bar */}
      <div className="bg-card-bg rounded-2xl border border-outline-variant p-3 flex flex-col gap-2.5 shadow-sm">
        {/* Category Select Dropdown for direct 1-click jump on mobile */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-secondary" /> Výběr kategorie:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer truncate"
          >
            <option value="ALL">Všechny kategorie</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Scrollable Pills with Scroll Arrow Navigation Buttons */}
        <div className="relative flex items-center gap-1 pt-2 border-t border-outline-variant/60">
          <button
            onClick={scrollLeft}
            className="p-1.5 bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface rounded-lg border border-outline-variant shrink-0"
            title="Posunout kategorie vlevo"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-2 no-scrollbar py-1 scroll-smooth flex-1"
          >
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-primary-container text-on-primary-container border border-primary'
                  : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:border-outline'
              }`}
            >
              Všechny kategorie
            </button>

            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container border border-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:border-outline'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={scrollRight}
            className="p-1.5 bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface rounded-lg border border-outline-variant shrink-0"
            title="Posunout kategorie vpravo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredCatalog.length === 0 ? (
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-outline flex flex-col items-center gap-3">
          <Info className="w-10 h-10 text-outline/50" />
          <p>
            {hideAlreadyAdded && addedCatalogIds.size > 0
              ? 'Všechny položky v této kategorii jsou již přidány v zakázce.'
              : 'Žádná technika neodpovídá zadanému filtru.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCatalog.map((item) => (
            <CatalogCardItem
              key={item.id}
              item={item}
              isAlreadyInJob={addedCatalogIds.has(item.id)}
              currentJob={currentJob}
              isEditMode={isEditMode}
              onAdd={handleAdd}
              onOpenBundle={setActiveBundleModal}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {/* Bundle Modal */}
      {activeBundleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono text-primary font-bold">SLOŽENÍ BALÍČKU</span>
                <h3 className="text-xl font-bold text-on-surface">{activeBundleModal.name}</h3>
              </div>
              <button
                onClick={() => setActiveBundleModal(null)}
                className="text-outline hover:text-on-surface p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 my-2">
              {activeBundleModal.bundleItems?.map((sub, idx) => (
                <div key={idx} className="flex justify-between items-center bg-surface-container p-2.5 rounded-lg border border-outline-variant text-sm">
                  <span className="text-on-surface font-medium">{sub.name}</span>
                  <span className="font-mono font-bold text-primary">{sub.qty} ks</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setActiveBundleModal(null)}
                className="flex-1 py-2.5 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
              >
                Zavřít
              </button>
              <button
                onClick={() => {
                  handleAdd(activeBundleModal);
                  setActiveBundleModal(null);
                }}
                className="flex-1 py-2.5 bg-secondary text-on-secondary-container font-semibold rounded-xl text-sm flex items-center justify-center gap-1 shadow"
              >
                <Plus className="w-4 h-4" /> Vložit Set do Zakázky
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
