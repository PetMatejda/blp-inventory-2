import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { Plus, Minus, CheckCircle, Package, AlertTriangle, RefreshCw, Check, Image as ImageIcon, Trash2, MoreVertical, RotateCcw, ChevronDown, ChevronUp, Layers } from 'lucide-react';

export const ItemSwipeCard = ({ item, onOpenPhoto }) => {
  const { updateItemQuantity, setItemLoadedOrPacked, setItemPending, toggleItemStatus, setDamageReportItem, deleteJobItem, currentJob, setContextMenu } = useInventory();
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showBundleItems, setShowBundleItems] = useState(false);
  const startXRef = useRef(0);

  const isModeDerigging = currentJob?.mode === 'DERIGGING';

  // Category Icon Metadata
  const catMeta = getCategoryMeta(item.category);
  const CatIcon = catMeta.icon;

  // Long press handler for Context Menu
  const longPressProps = useLongPress(
    (e) => {
      e.stopPropagation();
      setContextMenu({ type: 'PACKING_ITEM', target: { ...item, onOpenPhoto } });
    },
    () => {
      if (onOpenPhoto) onOpenPhoto(item);
    }
  );

  // Mouse / Touch swipe handlers with long-press cancellation
  const handleTouchStart = (e) => {
    startXRef.current = e.touches ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
    longPressProps.onMouseDown(e);
  };

  const handleTouchMove = (e) => {
    longPressProps.onMouseMove(e);
    if (!isDragging) return;
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const diff = currentX - startXRef.current;

    if (Math.abs(diff) > 8) {
      longPressProps.cancelLongPress();
    }

    setDragOffset(Math.max(-120, Math.min(120, diff)));
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset > 70) {
      setItemLoadedOrPacked(item.id);
    } else if (dragOffset < -70) {
      setItemPending(item.id);
    } else {
      longPressProps.onMouseUp(e);
    }

    setDragOffset(0);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Opravdu chcete odebrat položku "${item.name}" ze zakázky?`)) {
      deleteJobItem(item.id);
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case 'LOADED':
        return (
          <span className="bg-secondary text-on-secondary-container px-2 py-0.5 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" /> Na place / Naloženo
          </span>
        );
      case 'PACKED':
        return (
          <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm">
            <Package className="w-3.5 h-3.5" /> Sbaleno k odvozu
          </span>
        );
      case 'DAMAGED':
        return (
          <span className="bg-error-container text-on-error-container border border-error px-2 py-0.5 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5" /> Poškozeno ({item.damageSeverity || 'ZÁVADA'})
          </span>
        );
      default:
        return (
          <span className="bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 border border-outline-variant">
            K naložení
          </span>
        );
    }
  };

  const getBorderColor = () => {
    switch (item.status) {
      case 'LOADED':
        return 'border-l-4 border-l-secondary border-outline-variant';
      case 'PACKED':
        return 'border-l-4 border-l-tertiary-container border-outline-variant';
      case 'DAMAGED':
        return 'border-l-4 border-l-error border-error-container';
      default:
        return 'border-l-4 border-l-outline-variant border-outline-variant';
    }
  };

  const photoUrl = item.photoUrls?.[0] || 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80';

  return (
    <div className="swipe-card-container bg-surface-container rounded-xl overflow-hidden shadow-sm relative group select-none">
      {/* Background action reveal layers - Mode Aware */}
      <div className="absolute inset-0 flex justify-between z-0 pointer-events-none font-bold text-xs">
        <div
          className={`w-1/2 flex items-center justify-start pl-4 gap-1.5 ${
            isModeDerigging ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          <Check className="w-5 h-5" />
          <span>{isModeDerigging ? '✓ SBALENO (Naloženo k odvozu)' : '✓ NALOŽIT (Na place)'}</span>
        </div>

        <div className="bg-surface-variant text-on-surface-variant w-1/2 flex items-center justify-end pr-4 gap-1.5 border-l border-outline-variant">
          <span>{isModeDerigging ? '↩ NENALOŽENO' : '↩ K NALOŽENÍ (Připraveno)'}</span>
          <RotateCcw className="w-4 h-4" />
        </div>
      </div>

      {/* Swipeable content layer */}
      <div
        className={`swipe-content bg-card-bg flex border ${getBorderColor()} rounded-xl relative z-10 transition-transform cursor-pointer ${
          isDragging ? 'transition-none' : 'duration-200'
        }`}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        <div className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            {/* Header with Category Icon, Truncated Title & Action Buttons */}
            <div className="flex items-start justify-between mb-2 gap-2 w-full">
              {/* Left Title Box with min-w-0 flex-1 */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 shadow-xs ${catMeta.color}`}
                  title={`Kategorie: ${catMeta.label}`}
                >
                  <CatIcon className="w-4 h-4" />
                </span>

                <h3
                  className="font-bold text-base text-on-surface leading-tight truncate min-w-0 flex-1"
                  title={item.name}
                >
                  {item.name}
                </h3>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenPhoto) onOpenPhoto(item);
                  }}
                  className="p-1 bg-surface-container hover:bg-surface-container-high text-primary rounded-lg border border-outline-variant transition-colors shrink-0"
                  title="Zobrazit fotku a detaily"
                >
                  <ImageIcon className="w-4 h-4 text-primary" />
                </button>
              </div>

              {/* Right Action Bar (Always visible, never pushed off-screen) */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {getStatusBadge()}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDamageReportItem(item);
                  }}
                  className="p-1 text-outline hover:text-error hover:bg-error-container/30 border border-transparent hover:border-error/40 rounded-lg transition-colors"
                  title="Rychlé Hlášení Závady / Poškození"
                >
                  <AlertTriangle className="w-4 h-4 text-error" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({ type: 'PACKING_ITEM', target: { ...item, onOpenPhoto } });
                  }}
                  className="p-1 text-outline hover:text-on-surface rounded-lg"
                  title="Kontextové menu položky"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                <button
                  onClick={handleDelete}
                  className="p-1 text-outline hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                  title="Odebrat ze zakázky"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Badges: Set/Bundle Tag, Serial Number */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {item.isBundle && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBundleItems(!showBundleItems);
                  }}
                  className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-primary/40 flex items-center gap-1 hover:opacity-90 transition-opacity"
                >
                  <Layers className="w-3.5 h-3.5" /> SET / BALÍČEK ({item.bundleItems?.length || 0} dílů)
                  {showBundleItems ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                </button>
              )}

              {item.bundleTag && (
                <span className="bg-primary-container/30 text-on-primary-container px-2 py-0.5 rounded text-[11px] font-mono border border-primary/30 flex items-center gap-1">
                  <Package className="w-3 h-3" /> {item.bundleTag}
                </span>
              )}

              {item.serialNumber && (
                <span className="text-[11px] font-mono text-outline">
                  SN: {item.serialNumber}
                </span>
              )}
            </div>

            {/* Expandable Set Contents list */}
            {item.isBundle && showBundleItems && item.bundleItems && (
              <div className="bg-surface-container/80 border border-primary/30 rounded-xl p-2.5 mb-3 text-xs flex flex-col gap-1.5 animate-in fade-in duration-150">
                <span className="font-mono text-[10px] font-bold text-primary uppercase block">OBSAH BALÍČKU / SETU:</span>
                {item.bundleItems.map((sub, idx) => (
                  <div key={idx} className="flex justify-between items-center text-on-surface-variant font-mono text-[11px]">
                    <span>• {sub.name}</span>
                    <span className="font-bold text-primary">{sub.qty * item.quantityRequested} ks</span>
                  </div>
                ))}
              </div>
            )}

            {/* Damage Notes section if damaged */}
            {item.status === 'DAMAGED' && (
              <div className="bg-error-container/20 border border-error/30 rounded-lg p-2.5 mb-3 text-xs text-on-error-container flex justify-between items-center gap-2">
                <div>
                  <strong className="block text-error">Popis poškození:</strong>
                  <span>{item.damageNotes || 'Bez popisu poruchy'}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItemStatus(item.id);
                  }}
                  className="px-2.5 py-1 bg-surface-variant text-on-surface rounded text-xs font-semibold hover:bg-surface-bright flex items-center gap-1 shrink-0 border border-outline-variant"
                >
                  <RefreshCw className="w-3 h-3 text-secondary" /> Opraveno
                </button>
              </div>
            )}
          </div>

          {/* Giga-Stepper Controls */}
          <div className="flex items-center gap-3 bg-surface-container p-1.5 rounded-xl border border-outline-variant mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateItemQuantity(item.id, -1);
              }}
              disabled={item.quantityLoaded <= 0}
              className="giga-btn w-11 h-11 flex items-center justify-center bg-surface-variant text-on-surface rounded-lg border border-outline-variant hover:bg-surface-bright disabled:opacity-30 disabled:pointer-events-none"
              title="Odečíst (-1)"
            >
              <Minus className="w-6 h-6 stroke-[2.5]" />
            </button>

            <div className="flex-1 text-center font-mono font-bold text-xl text-primary tracking-tight">
              {item.quantityLoaded}
              <span className="text-on-surface-variant text-sm font-normal"> / {item.quantityRequested} {item.isBundle ? 'setů' : 'ks'}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                updateItemQuantity(item.id, 1);
              }}
              className="giga-btn w-11 h-11 flex items-center justify-center bg-surface-variant text-on-surface rounded-lg border border-outline-variant hover:bg-surface-bright"
              title="Přičíst (+1)"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Clickable thumbnail preview for desktop & tablet */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenPhoto) onOpenPhoto(item);
          }}
          className="w-28 min-h-[140px] bg-surface-container-lowest hidden xs:flex items-center justify-center p-2 border-l border-outline-variant/40 shrink-0 cursor-pointer group-hover:bg-surface-container-high transition-colors relative"
          title="Klikněte pro zobrazení fotky na celou obrazovku"
        >
          <img
            src={photoUrl}
            alt={item.name}
            className="max-h-28 max-w-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
          />
          <span className="absolute bottom-1 right-1 bg-black/60 text-white p-1 rounded text-[10px]">
            <ImageIcon className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};
