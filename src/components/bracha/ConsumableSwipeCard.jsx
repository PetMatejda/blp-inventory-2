import React, { useState, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { AlertTriangle, CheckCircle, RefreshCw, MoreVertical, ChevronRight, ChevronLeft } from 'lucide-react';

export const ConsumableSwipeCard = ({ item }) => {
  const { updateConsumableState, setContextMenu } = useInventory();
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const longPressProps = useLongPress(
    (e) => {
      e.stopPropagation();
      setContextMenu({ type: 'CONSUMABLE', target: item });
    },
    () => {
      // Tap = worsen state (intuitive: tap to mark as needing refill)
      if (item.state < 2) updateConsumableState(item.id, item.state + 1);
    }
  );

  // Swipe RIGHT = zlepšit stav (směrem k OK)
  // Swipe LEFT  = zhoršit stav (směrem k REFILL)
  // Žádné cyklické wrapping — na hranici (0 nebo 2) swipe nemá efekt

  const handleImprove = () => {
    if (item.state > 0) updateConsumableState(item.id, item.state - 1);
  };

  const handleWorsen = () => {
    if (item.state < 2) updateConsumableState(item.id, item.state + 1);
  };

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

    setDragOffset(Math.max(-100, Math.min(100, diff)));
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset > 60) {
      handleImprove(); // Doprava = zlepšit
    } else if (dragOffset < -60) {
      handleWorsen();  // Doleva = zhoršit
    } else {
      longPressProps.onMouseUp(e);
    }

    setDragOffset(0);
  };

  const getStatusVisuals = () => {
    switch (item.state) {
      case 0:
        return {
          cardBg: 'bg-card-bg border-emerald-500/50 text-emerald-400',
          badgeBg: 'bg-emerald-500 text-slate-950',
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'OK (100%)',
        };
      case 1:
        return {
          cardBg: 'bg-card-bg border-amber-500/50 text-amber-300',
          badgeBg: 'bg-amber-400 text-slate-950',
          icon: <AlertTriangle className="w-4 h-4" />,
          label: '50% (Doplnit)',
        };
      case 2:
        return {
          cardBg: 'bg-card-bg border-rose-500/60 text-rose-300',
          badgeBg: 'bg-rose-500 text-white animate-pulse',
          icon: <RefreshCw className="w-4 h-4" />,
          label: 'REFILL (Prázdné)',
        };
      default:
        return {
          cardBg: 'bg-card-bg border-outline-variant text-on-surface',
          badgeBg: 'bg-surface-variant text-outline',
          icon: null,
          label: 'OK',
        };
    }
  };

  const vis = getStatusVisuals();

  return (
    <div className="swipe-card-container rounded-2xl overflow-hidden shadow-sm relative group select-none bg-surface-container">
      {/* Background action reveal layers */}
      <div className="absolute inset-0 flex justify-between z-0 pointer-events-none font-bold text-xs">
        {/* Swipe RIGHT → Zlepšit (green) */}
        <div className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 w-1/2 flex items-center justify-start pl-4 gap-1">
          <ChevronRight className="w-5 h-5" /> Zlepšit (→ OK)
        </div>
        {/* Swipe LEFT → Zhoršit (red) */}
        <div className="bg-rose-500/15 text-rose-700 dark:text-rose-300 w-1/2 flex items-center justify-end pr-4 gap-1">
          Zhoršit (→ Refill) <ChevronLeft className="w-5 h-5" />
        </div>
      </div>

      {/* Solid opaque swipeable content layer (prevents text bleed-through) */}
      <div
        className={`swipe-content p-4 rounded-2xl border transition-transform cursor-pointer relative z-10 flex flex-col justify-between ${vis.cardBg} ${
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
        <div className="flex justify-between items-start mb-3 gap-2">
          <div>
            <span className="text-[10px] font-mono text-outline uppercase">{item.category}</span>
            <h3 className="font-bold text-base text-on-surface leading-tight mt-0.5">{item.name}</h3>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu({ type: 'CONSUMABLE', target: item });
            }}
            className="p-1 text-outline hover:text-on-surface rounded-lg"
            title="Kontextové menu spotřebního materiálu"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/30">
          <span className={`px-2.5 py-1 rounded font-mono text-xs font-bold flex items-center gap-1.5 ${vis.badgeBg}`}>
            {vis.icon} {vis.label}
          </span>

          <span className="text-[11px] font-mono text-outline flex items-center gap-0.5">
            Swipe ↔ / Click
          </span>
        </div>
      </div>
    </div>
  );
};
