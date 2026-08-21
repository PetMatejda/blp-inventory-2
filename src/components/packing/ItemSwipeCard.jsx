import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { ItemThumbnail } from '../common/ItemThumbnail';
import { Plus, Minus, CheckCircle, Package, AlertTriangle, RefreshCw, Check, Trash2, MoreVertical, RotateCcw, ChevronDown, ChevronUp, Layers } from 'lucide-react';

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

    setDragOffset(Math.max(-140, Math.min(140, diff)));
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    // Effortless swipe threshold: 40px
    if (dragOffset > 40) {
      setItemLoadedOrPacked(item.id);
    } else if (dragOffset < -40) {
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
          <span className="bg-secondary text-on-secondary-container px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm border border-secondary/50">
            <CheckCircle className="w-3.5 h-3.5" /> Na place / Naloženo
          </span>
        );
      case 'PACKED':
        return (
          <span className="bg-tertiary-container text-on-tertiary-container px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm border border-tertiary/50">
            <Package className="w-3.5 h-3.5" /> Sbaleno k odvozu
          </span>
        );
      case 'DAMAGED':
        return (
          <span className="bg-error-container text-on-error-container border border-error px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5" /> Poškozeno ({item.damageSeverity || 'ZÁVADA'})
          </span>
        );
      default:
        return (
          <span className="bg-surface-container-highest text-on-surface-variant px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1 shrink-0 border border-outline-variant">
            K naložení
          </span>
        );
    }
  };

  // Dedicated Left Accent Bar Color (Guaranteed dynamic color updates)
  const getStatusAccentColor = () => {
    switch (item.status) {
      case 'LOADED':
        return '#10b981'; // Emerald Green
      case 'PACKED':
        return '#06b6d4'; // Cyan Blue
      case 'DAMAGED':
        return '#ef4444'; // Bright Red
      default:
        return '#475569'; // Slate Gray for Pending
    }
  };

  const photoUrl = item.photoUrls?.[0] || item.image || '';

  return (
    <div className="swipe-card-container bg-surface-container rounded-xl overflow-hidden shadow-sm relative group select-none touch-pan-y">
      {/* Background action reveal layers - Mode Aware */}
      <div className="absolute inset-0 flex justify-between z-0 pointer-events-none font-bold text-xs">
        <div
          className={`w-1/2 flex items-center justify-start pl-4 gap-1.5 ${
            isModeDerigging ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          <Check className="w-5 h-5" />
          <span>{isModeDerigging ? '✓ SBALENO' : '✓ NALOŽIT'}</span>
        </div>

        <div className="bg-surface-variant text-on-surface-variant w-1/2 flex items-center justify-end pr-4 gap-1.5 border-l border-outline-variant">
          <span>{isModeDerigging ? '↩ VRÁTIT NA PLACE' : '↩ K NALOŽENÍ'}</span>
          <RotateCcw className="w-4 h-4" />
        </div>
      </div>

      {/* Swipeable content layer */}
      <div
        className={`swipe-content flex border border-outline-variant rounded-xl relative z-10 transition-transform cursor-pointer bg-card-bg overflow-hidden ${
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
        {/* Dedicated Left Dynamic Status Color Stripe */}
        <div
          className="w-3 shrink-0 transition-colors duration-300 self-stretch"
          style={{ backgroundColor: getStatusAccentColor() }}
          title={`Stav: ${item.status}`}
        />

        <div className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            {/* Row 1: Category Icon + Item Title Name (100% Width & Unobstructed) */}
            <div className="flex items-center gap-2 mb-2 w-full">
              <span
                className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 shadow-xs ${catMeta.color}`}
                title={`Kategorie: ${catMeta.label}`}
              >
                <CatIcon className="w-4 h-4" />
              </span>

              <h3
                className="font-bold text-base text-on-surface leading-tight break-words flex-1"
                title={item.name}
              >
                {item.name}
              </h3>
            </div>

            {/* Row 2: Status Badge + Action Buttons (Dedicated row, never overwriting title) */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge()}

                {item.isBundle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBundleItems(!showBundleItems);
                    }}
                    className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-primary/40 flex items-center gap-1 hover:opacity-90 transition-opacity"
                  >
                    <Layers className="w-3.5 h-3.5" /> SET ({item.bundleItems?.length || 0} dílů)
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

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0 ml-auto">
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

        {/* Thumbnail Preview with automatic Category Icon fallback */}
        <div className="w-28 min-h-[140px] bg-surface-container-lowest hidden xs:flex items-center justify-center p-2 border-l border-outline-variant/40 shrink-0 cursor-pointer group-hover:bg-surface-container-high transition-colors relative">
          <ItemThumbnail
            src={photoUrl}
            name={item.name}
            category={item.category}
            className="w-full h-full"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenPhoto) onOpenPhoto(item);
            }}
          />
        </div>
      </div>
    </div>
  );
};
