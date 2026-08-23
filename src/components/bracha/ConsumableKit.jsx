import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ConsumableSwipeCard } from './ConsumableSwipeCard';
import { Package, AlertTriangle, CheckCircle, Search } from 'lucide-react';

export const ConsumableKit = () => {
  const { consumables } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = ['ALL', 'Pásky', 'Baterie', 'Čištění', 'Drobný materiál'];

  const filteredConsumables = consumables.filter((c) => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const refillItems = consumables.filter(c => c.state === 2);
  const halfItems = consumables.filter(c => c.state === 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4 pb-28">
      {/* Header */}
      <div>
        <p className="text-xs text-outline">← Swipe doleva = zhoršit stav  |  Swipe doprava = zlepšit →</p>
      </div>


      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card-bg border-2 border-emerald-500/50 p-3 rounded-xl flex flex-col items-center shadow-sm">
          <span className="text-xs font-mono text-emerald-400 font-bold uppercase">100% OK</span>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {consumables.filter(c => c.state === 0).length}
          </span>
        </div>
        <div className="bg-card-bg border-2 border-amber-500/50 p-3 rounded-xl flex flex-col items-center shadow-sm">
          <span className="text-xs font-mono text-amber-300 font-bold uppercase">50% DOPLNIT</span>
          <span className="text-2xl font-bold font-mono text-amber-300">
            {halfItems.length}
          </span>
        </div>
        <div className="bg-card-bg border-2 border-rose-500/60 p-3 rounded-xl flex flex-col items-center shadow-sm">
          <span className="text-xs font-mono text-rose-400 font-bold uppercase">REFILL IHNED</span>
          <span className="text-2xl font-bold font-mono text-rose-400">
            {refillItems.length}
          </span>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat pásku, baterie, čistič..."
            className="w-full h-12 pl-11 pr-4 bg-surface-container border border-outline-variant rounded-xl text-on-surface text-sm focus:border-primary focus:outline-none placeholder:text-outline"
          />
        </div>

        <div className="flex overflow-x-auto gap-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-full font-mono text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-primary-container text-on-primary-container border border-primary'
                  : 'bg-surface-container text-on-surface-variant border border-outline-variant'
              }`}
            >
              {cat === 'ALL' ? 'Vše' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Consumables Grid with Swipe Gestures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredConsumables.map((item) => (
          <ConsumableSwipeCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};
