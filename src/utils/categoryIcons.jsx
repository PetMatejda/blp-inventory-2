import React from 'react';
import { Sun, Cpu, Maximize, Plug, Radio, Anchor, Layers, Package } from 'lucide-react';

export const CATEGORIES = [
  { id: 'Lights', label: 'Světla', icon: Sun, color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' },
  { id: 'Ballasts', label: 'Balasty & Zdroje', icon: Cpu, color: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/40' },
  { id: 'Textiles', label: 'Textil & Difúze', icon: Maximize, color: 'text-purple-400 bg-purple-500/20 border-purple-500/40' },
  { id: 'Cables', label: 'Kábly', icon: Plug, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40' },
  { id: 'Distribution', label: 'Distribuce', icon: Radio, color: 'text-blue-400 bg-blue-500/20 border-blue-500/40' },
  { id: 'Grip', label: 'Stativy & Grip', icon: Anchor, color: 'text-orange-400 bg-orange-500/20 border-orange-500/40' },
  { id: 'Kits', label: 'Sety & Balíčky', icon: Layers, color: 'text-pink-400 bg-pink-500/20 border-pink-500/40' },
];

export const getCategoryMeta = (catName) => {
  if (!catName) return CATEGORIES[0];
  const q = catName.toLowerCase();
  if (q.includes('light') || q.includes('svět')) return CATEGORIES[0];
  if (q.includes('ballast') || q.includes('balast') || q.includes('zdroj')) return CATEGORIES[1];
  if (q.includes('textil') || q.includes('difúz') || q.includes('screen') || q.includes('butterfly')) return CATEGORIES[2];
  if (q.includes('cable') || q.includes('kábel') || q.includes('kabel')) return CATEGORIES[3];
  if (q.includes('distrib') || q.includes('rozvad')) return CATEGORIES[4];
  if (q.includes('grip') || q.includes('stand') || q.includes('stativ')) return CATEGORIES[5];
  if (q.includes('kit') || q.includes('set') || q.includes('balíček')) return CATEGORIES[6];

  return { id: catName, label: catName, icon: Package, color: 'text-slate-400 bg-slate-500/20 border-slate-500/40' };
};
