import React from 'react';
import {
  Sun, Cpu, Maximize, Plug, Radio, Anchor, Layers, Package, Wrench,
  Cloud, Cylinder, Globe, Box, Egg, Disc3, LampFloor, Lightbulb, PanelTop, Grid3x3,
  SlidersHorizontal, Cable, PlugZap, Split, Fan, Aperture, SquareDashed, Grid2x2, Frame,
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'Lights', label: 'Světla', icon: Sun, color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' },
  { id: 'Ballasts', label: 'Balasty & Zdroje', icon: Cpu, color: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/40' },
  { id: 'Textiles', label: 'Textil & Difúze', icon: Maximize, color: 'text-purple-400 bg-purple-500/20 border-purple-500/40' },
  { id: 'Cables', label: 'Kábly', icon: Plug, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40' },
  { id: 'Distribution', label: 'Distribuce', icon: Radio, color: 'text-blue-400 bg-blue-500/20 border-blue-500/40' },
  { id: 'Grip', label: 'Stativy & Grip', icon: Anchor, color: 'text-orange-400 bg-orange-500/20 border-orange-500/40' },
  { id: 'Tools', label: 'Nářadí', icon: Wrench, color: 'text-lime-400 bg-lime-500/20 border-lime-500/40' },
  { id: 'Kits', label: 'Sety & Balíčky', icon: Layers, color: 'text-pink-400 bg-pink-500/20 border-pink-500/40' },
];

export const getCategoryMeta = (catName) => {
  if (!catName) return CATEGORIES[0];
  const q = catName.toLowerCase();
  if (q.includes('light') || q.includes('svět')) return CATEGORIES[0];
  if (q.includes('ballast') || q.includes('balast') || q.includes('zdroj')) return CATEGORIES[1];
  if (q.includes('textil') || q.includes('difúz') || q.includes('screen') || q.includes('butterfly')) return CATEGORIES[2];
  if (q.includes('cable') || q.includes('kábel') || q.includes('kábl') || q.includes('kabel')) return CATEGORIES[3];
  if (q.includes('distrib') || q.includes('rozvad')) return CATEGORIES[4];
  if (q.includes('grip') || q.includes('stand') || q.includes('stativ')) return CATEGORIES[5];
  if (q.includes('tool') || q.includes('nářad')) return CATEGORIES[6];
  if (q.includes('kit') || q.includes('set') || q.includes('balíček')) return CATEGORIES[7];

  return { id: catName, label: catName, icon: Package, color: 'text-slate-400 bg-slate-500/20 border-slate-500/40' };
};

/** Springball balloon: a sphere on a short stand (no fitting Lucide icon). */
export const SpringballIcon = ({ className = '', strokeWidth = 2, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
    <circle cx="12" cy="9" r="7" />
    <path d="M5.5 7.5c4 1.6 9 1.6 13 0" />
    <path d="M12 16v6" />
    <path d="M8 22h8" />
  </svg>
);

/**
 * Icon of a single equipment type (catalog `icon` field). Falls back to the
 * category icon when the item has none.
 */
export const ITEM_ICONS = [
  { id: 'cloud', label: 'Balon Cloud', icon: Cloud },
  { id: 'cylinder', label: 'Balon Tuba', icon: Cylinder },
  { id: 'globe', label: 'Balon Koule', icon: Globe },
  { id: 'box', label: 'Balon Kostka', icon: Box },
  { id: 'egg', label: 'Balon Elipsa', icon: Egg },
  { id: 'disc', label: 'Balon Zero gravity', icon: Disc3 },
  { id: 'lampFloor', label: 'Balon Gaffair', icon: LampFloor },
  { id: 'springball', label: 'Springball', icon: SpringballIcon },
  { id: 'lightbulb', label: 'Světelná vložka', icon: Lightbulb },
  { id: 'panel', label: 'LED panel', icon: PanelTop },
  { id: 'grid', label: 'LED síť', icon: Grid3x3 },
  { id: 'cpu', label: 'Balast / zdroj', icon: Cpu },
  { id: 'dimmer', label: 'Dimmer', icon: SlidersHorizontal },
  { id: 'cable', label: 'Kabel', icon: Cable },
  { id: 'adapter', label: 'Redukce', icon: PlugZap },
  { id: 'split', label: 'Rozbočovač', icon: Split },
  { id: 'radio', label: 'Bezdrátové DMX', icon: Radio },
  { id: 'fan', label: 'Fukar', icon: Fan },
  { id: 'filter', label: 'Filtr', icon: Aperture },
  { id: 'cloth', label: 'Látka / difúze', icon: SquareDashed },
  { id: 'eggcrate', label: 'Eggcrate', icon: Grid2x2 },
  { id: 'frame', label: 'Rám', icon: Frame },
];

/** Category meta (label, colour) with the item's own icon when it has one. */
export const getItemMeta = (item) => {
  const meta = getCategoryMeta(item?.category);
  const own = ITEM_ICONS.find((i) => i.id === item?.icon);
  return own ? { ...meta, icon: own.icon } : meta;
};
