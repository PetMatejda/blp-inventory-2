import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { ItemThumbnail } from '../common/ItemThumbnail';
import {
  Plus, Minus, CheckCircle, Package, AlertTriangle,
  RefreshCw, Trash2, MoreVertical, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

// Status accent bar color
const STATUS_COLORS = {
  LOADED: '#10b981',
  PACKED: '#06b6d4',
  DAMAGED: '#ef4444',
  PENDING: '#475569',
};

// Status badge component — uses theme-aware colors that work in both light and dark mode
const StatusBadge = ({ status, damageSeverity }) => {
  switch (status) {
    case 'LOADED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 border border-emerald-500/40 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700/60 text-[11px] font-bold font-mono">
          <CheckCircle className="w-3 h-3" /> Na place
        </span>
      );
    case 'PACKED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 border border-blue-500/40 dark:bg-cyan-900/60 dark:text-cyan-300 dark:border-cyan-700/60 text-[11px] font-bold font-mono">
          <Package className="w-3 h-3" /> K odvozu
        </span>
      );
    case 'DAMAGED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-error-container/40 text-error border border-error/50 text-[11px] font-bold font-mono">
          <AlertTriangle className="w-3 h-3" /> {damageSeverity || 'ZÁVADA'}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-variant text-on-surface-variant border border-outline-variant text-[11px] font-mono">
          K naložení
        </span>
      );
  }
};

export const ItemSwipeCard = ({ item, onOpenPhoto }) => {
  const {
    updateItemQuantity,
    setItemLoadedOrPacked,
    setItemPending,
    toggleItemStatus,
    setDamageReportItem,
    deleteJobItem,
    currentJob,
    setContextMenu,
  } = useInventory();

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showBundleItems, setShowBundleItems] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizRef = useRef(false);

  const isModeDerigging = currentJob?.mode === 'DERIGGING';
  const catMeta = getCategoryMeta(item.category);
  const CatIcon = catMeta.icon;
  const photoUrl = item.photoUrls?.[0] || item.image || '';

  // Long press for context menu
  const longPressProps = useLongPress(
    (e) => {
      e.stopPropagation();
      setContextMenu({ type: 'PACKING_ITEM', target: { ...item, onOpenPhoto } });
    },
    () => {
      if (onOpenPhoto) onOpenPhoto(item);
    }
  );

  // Touch handlers — distinguish horizontal swipe from vertical scroll
  const handleTouchStart = (e) => {
    const touch = e.touches?.[0] || e;
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isHorizRef.current = false;
    setIsDragging(true);
    longPressProps.onMouseDown(e);
  };

  const handleTouchMove = (e) => {
    longPressProps.onMouseMove(e);
    if (!isDragging) return;

    const touch = e.touches?.[0] || e;
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    // Determine gesture direction on first significant move
    if (!isHorizRef.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    if (!isHorizRef.current) {
      isHorizRef.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizRef.current) {
      // Vertical scroll — don't interfere
      setDragOffset(0);
      return;
    }

    // Horizontal swipe
    if (Math.abs(dx) > 8) longPressProps.cancelLongPress();
    setDragOffset(Math.max(-130, Math.min(130, dx)));
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(dragOffset) > 40) {
      if (dragOffset > 40) {
        setItemLoadedOrPacked(item.id);
      } else {
        setItemPending(item.id);
      }
    } else {
      longPressProps.onMouseUp(e);
    }

    setDragOffset(0);
    isHorizRef.current = false;
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Odebrat „${item.name}" ze zakázky?`)) {
      deleteJobItem(item.id);
    }
  };

  return (
    <div className="swipe-card-container bg-surface-container rounded-2xl overflow-hidden shadow-sm relative select-none">

      {/* Background swipe hints */}
      <div className="absolute inset-0 flex z-0 pointer-events-none">
        {/* Left reveal: Load / Pack — green/blue theme-aware */}
        <div
          className={`w-1/2 flex items-center justify-start pl-5 gap-2 text-xs font-bold ${
            isModeDerigging
              ? 'bg-blue-500/25 text-blue-700 dark:bg-blue-900/80 dark:text-blue-300'
              : 'bg-emerald-500/25 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-300'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
          {isModeDerigging ? 'SBALENO' : 'NALOŽENO'}
        </div>
        {/* Right reveal: Pending */}
        <div className="w-1/2 flex items-center justify-end pr-5 gap-2 bg-surface-variant/80 text-on-surface-variant text-xs font-bold">
          {isModeDerigging ? 'VRÁTIT NA PLACE' : 'K NALOŽENÍ'}
          <RefreshCw className="w-4 h-4" />
        </div>
      </div>

      {/* Swipeable card */}
      <div
        className={`flex relative z-10 bg-card-bg rounded-2xl overflow-hidden ${
          isDragging ? '' : 'transition-transform duration-200'
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
        {/* Status accent stripe — left edge */}
        <div
          className="w-1.5 shrink-0 self-stretch transition-colors duration-300"
          style={{ backgroundColor: STATUS_COLORS[item.status] || STATUS_COLORS.PENDING }}
        />

        {/* Main card body */}
        <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">

          {/* Row 1: Category icon + Item name + actions */}
          <div className="flex items-start gap-2">
            {/* Category badge */}
            <span
              className={`mt-0.5 p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${catMeta.color}`}
              title={catMeta.label}
            >
              <CatIcon className="w-4 h-4" />
            </span>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-on-surface leading-tight break-words">
                {item.name}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <StatusBadge status={item.status} damageSeverity={item.damageSeverity} />
                {item.bundleTag && (
                  <span className="text-[10px] font-mono text-outline">
                    <Package className="w-2.5 h-2.5 inline mr-0.5" />{item.bundleTag}
                  </span>
                )}
                {item.serialNumber && (
                  <span className="text-[10px] font-mono text-outline">SN: {item.serialNumber}</span>
                )}
              </div>
            </div>

            {/* Actions: damage + context menu */}
            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
              {item.isBundle && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowBundleItems(!showBundleItems); }}
                  className="p-1.5 rounded-lg text-primary hover:bg-primary-container/20 transition-colors active:scale-90"
                  title="Obsah setu"
                >
                  <Layers className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setDamageReportItem(item); }}
                className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors active:scale-90"
                title="Hlásit závadu"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({ type: 'PACKING_ITEM', target: { ...item, onOpenPhoto } });
                }}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface transition-colors active:scale-90"
                title="Více možností"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Damage notes if damaged */}
          {item.status === 'DAMAGED' && item.damageNotes && (
            <div className="bg-error-container/20 border border-error/30 rounded-xl p-2 flex justify-between items-start gap-2 text-xs">
              <div>
                <strong className="text-error block">Popis poškození:</strong>
                <span className="text-on-error-container">{item.damageNotes}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleItemStatus(item.id); }}
                className="px-2 py-1 bg-surface-variant text-on-surface rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 border border-outline-variant active:scale-95"
              >
                <RefreshCw className="w-3 h-3 text-secondary" /> Opraveno
              </button>
            </div>
          )}

          {/* Set contents */}
          {item.isBundle && showBundleItems && item.bundleItems && (
            <div className="bg-surface-container-high border border-primary/20 rounded-xl p-2 text-xs flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold text-primary uppercase">OBSAH SETU:</span>
              {item.bundleItems.map((sub, idx) => (
                <div key={idx} className="flex justify-between text-on-surface-variant font-mono text-[11px]">
                  <span>• {sub.name}</span>
                  <span className="font-bold text-primary">{sub.qty * item.quantityRequested} ks</span>
                </div>
              ))}
            </div>
          )}

          {/* Stepper row */}
          <div className="flex items-center gap-2 bg-surface-container rounded-xl border border-outline-variant p-1">
            <button
              onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, -1); }}
              disabled={item.quantityLoaded <= 0}
              className="w-12 h-12 flex items-center justify-center bg-surface-variant rounded-lg border border-outline-variant disabled:opacity-30 disabled:pointer-events-none active:scale-90 transition-transform"
              title="Odečíst"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="flex-1 text-center">
              <span className="font-mono font-bold text-2xl text-primary leading-none">
                {item.quantityLoaded}
              </span>
              <span className="font-mono text-sm text-on-surface-variant">
                /{item.quantityRequested} {item.isBundle ? 'setů' : 'ks'}
              </span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); updateItemQuantity(item.id, 1); }}
              className="w-12 h-12 flex items-center justify-center bg-surface-variant rounded-lg border border-outline-variant active:scale-90 transition-transform"
              title="Přičíst"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Thumbnail — always shown, 80px wide */}
        <div className="w-20 bg-surface-container-lowest flex items-center justify-center p-1.5 border-l border-outline-variant/40 shrink-0">
          <ItemThumbnail
            src={photoUrl}
            name={item.name}
            category={item.category}
            className="w-full h-full rounded-xl"
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
