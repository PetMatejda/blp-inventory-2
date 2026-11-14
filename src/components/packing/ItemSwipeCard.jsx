import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { useDialogs } from '../common/Dialogs';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { phaseOf, statusLabel } from '../../domain/labels';
import { ItemThumbnail } from '../common/ItemThumbnail';
import { Plus, Minus, CheckCircle, AlertTriangle, RefreshCw, MoreVertical } from 'lucide-react';

// Status accent bar color
const STATUS_COLORS = {
  LOADED: '#10b981',
  PACKED: '#06b6d4',
  DAMAGED: '#ef4444',
  PENDING: '#475569',
};

const BADGE_STYLES = {
  LOADED: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700/60',
  PACKED: 'bg-cyan-500/15 text-cyan-800 border-cyan-500/40 dark:bg-cyan-900/60 dark:text-cyan-300 dark:border-cyan-700/60',
  DAMAGED: 'bg-error-container/40 text-error border-error/50',
  PENDING: 'bg-surface-variant text-on-surface-variant border-outline-variant',
};

const SEVERITY = { LIGHT: 'lehká', MAJOR: 'nefunkční', CRITICAL: 'kritická' };

const SWIPE_THRESHOLD = 40;

export const ItemSwipeCard = ({ item }) => {
  const {
    updateItemQuantity,
    setItemExactQuantity,
    setItemLoadedOrPacked,
    setItemPending,
    toggleItemStatus,
    currentJob,
    setContextMenu,
    setPhotoViewerItem,
  } = useInventory();
  const { askNumber } = useDialogs();

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizRef = useRef(false);

  const mode = currentJob?.mode || 'LOADING';
  const phase = phaseOf(mode);
  const isArchived = currentJob?.status === 'ARCHIVED';
  const catMeta = getCategoryMeta(item.category);
  const CatIcon = catMeta.icon;
  const photoUrl = item.photoUrls?.[0] || item.image || '';
  const openMenu = () => setContextMenu({ type: 'PACKING_ITEM', target: item });

  const { cancelLongPress, ...longPress } = useLongPress((e) => { e.stopPropagation(); openMenu(); }, () => {});

  // Touch handlers — distinguish horizontal swipe from vertical scroll
  const handleStart = (e) => {
    if (isArchived) return;
    const touch = e.touches?.[0] || e;
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isHorizRef.current = false;
    setIsDragging(true);
    longPress.onMouseDown(e);
  };

  const handleMove = (e) => {
    longPress.onMouseMove(e);
    if (!isDragging) return;
    const touch = e.touches?.[0] || e;
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;
    if (!isHorizRef.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    if (!isHorizRef.current) isHorizRef.current = Math.abs(dx) > Math.abs(dy);
    if (!isHorizRef.current) { setDragOffset(0); return; }
    if (Math.abs(dx) > 8) cancelLongPress();
    setDragOffset(Math.max(-130, Math.min(130, dx)));
  };

  const handleEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset > SWIPE_THRESHOLD) setItemLoadedOrPacked(item.id);
    else if (dragOffset < -SWIPE_THRESHOLD) setItemPending(item.id);
    else longPress.onMouseUp(e);
    setDragOffset(0);
    isHorizRef.current = false;
  };

  const editCount = async (e) => {
    e.stopPropagation();
    if (isArchived) return;
    const n = await askNumber({ title: item.name, message: `${phase.doneLabel} kusů`, value: item.quantityLoaded, max: item.quantityRequested });
    if (n != null) setItemExactQuantity(item.id, n);
  };

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div className="swipe-card-container bg-surface-container rounded-2xl overflow-hidden shadow-sm relative select-none">
      {/* Background swipe hints */}
      <div className="absolute inset-0 flex z-0 pointer-events-none" aria-hidden="true">
        <div className={`w-1/2 flex items-center justify-start pl-5 gap-2 text-sm font-bold ${
          mode === 'DERIGGING'
            ? 'bg-cyan-500/25 text-cyan-800 dark:bg-cyan-900/80 dark:text-cyan-300'
            : 'bg-emerald-500/25 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-300'
        }`}>
          <CheckCircle className="w-5 h-5" /> {phase.swipeDone}
        </div>
        <div className="w-1/2 flex items-center justify-end pr-5 gap-2 bg-surface-variant/80 text-on-surface-variant text-sm font-bold">
          {phase.swipeUndo} <RefreshCw className="w-4 h-4" />
        </div>
      </div>

      {/* Swipeable card */}
      <div
        className={`flex relative z-10 bg-card-bg rounded-2xl overflow-hidden ${isDragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        <div className="w-1.5 shrink-0 self-stretch transition-colors duration-300" style={{ backgroundColor: STATUS_COLORS[item.status] || STATUS_COLORS.PENDING }} />

        <div className="flex-1 p-3 flex flex-col gap-2.5 min-w-0">
          {/* Name, status, menu */}
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={stop(() => setPhotoViewerItem(item))}
              aria-label={`Fotky: ${item.name}`}
              className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-outline-variant/50"
            >
              <ItemThumbnail src={photoUrl} name={item.name} category={item.category} className="w-full h-full" />
            </button>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-on-surface leading-snug break-words">{item.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold ${BADGE_STYLES[item.status] || BADGE_STYLES.PENDING}`}>
                  {item.status === 'DAMAGED' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {statusLabel(item.status, mode)}
                  {item.status === 'DAMAGED' && item.damageSeverity && ` (${SEVERITY[item.damageSeverity] || item.damageSeverity})`}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs ${catMeta.color.split(' ')[0]}`}>
                  <CatIcon className="w-3.5 h-3.5" /> {catMeta.label}
                </span>
              </div>
              {item.serialNumber && <p className="text-xs font-mono text-on-surface-variant mt-1 truncate">SN: {item.serialNumber}</p>}
            </div>

            <button
              type="button"
              onClick={stop(openMenu)}
              className="w-11 h-11 -mr-1 shrink-0 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high active:scale-90"
              aria-label={`Další možnosti: ${item.name}`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Damage notes */}
          {item.status === 'DAMAGED' && (
            <div className="bg-error-container/20 border border-error/30 rounded-xl p-2.5 flex justify-between items-center gap-2">
              <p className="text-sm text-on-error-container min-w-0 break-words">{item.damageNotes || 'Závada bez popisu'}</p>
              {!isArchived && (
                <button
                  onClick={stop(() => toggleItemStatus(item.id))}
                  className="h-11 px-3 bg-surface-variant text-on-surface rounded-xl text-sm font-semibold flex items-center gap-1.5 shrink-0 border border-outline-variant active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 text-secondary" /> Opraveno
                </button>
              )}
            </div>
          )}

          {item.bundleTag && <p className="text-xs text-on-surface-variant">{item.bundleTag}</p>}

          {/* Stepper */}
          <div className="flex items-center gap-2 bg-surface-container rounded-xl border border-outline-variant p-1">
            <button
              onClick={stop(() => updateItemQuantity(item.id, -1))}
              disabled={isArchived || item.quantityLoaded <= 0}
              className="w-14 h-14 flex items-center justify-center bg-surface-variant rounded-lg border border-outline-variant disabled:opacity-30 disabled:pointer-events-none active:scale-90 transition-transform"
              aria-label={`Odečíst kus: ${item.name}`}
            >
              <Minus className="w-6 h-6 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={editCount}
              disabled={isArchived}
              className="flex-1 h-14 rounded-lg text-center hover:bg-surface-container-high active:scale-95 transition-transform"
              aria-label={`Zadat počet: ${item.quantityLoaded} z ${item.quantityRequested}`}
            >
              <span className="font-mono font-bold text-3xl text-primary leading-none">{item.quantityLoaded}</span>
              <span className="font-mono text-base text-on-surface-variant"> / {item.quantityRequested} ks</span>
            </button>

            <button
              onClick={stop(() => updateItemQuantity(item.id, 1))}
              disabled={isArchived}
              className="w-14 h-14 flex items-center justify-center bg-surface-variant rounded-lg border border-outline-variant disabled:opacity-30 active:scale-90 transition-transform"
              aria-label={`Přičíst kus: ${item.name}`}
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
