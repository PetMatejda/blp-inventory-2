import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { StockOverview } from './StockOverview';
import { StocktakeView } from './StocktakeView';
import { EquipmentCatalog } from '../catalog/EquipmentCatalog';
import { downloadText } from '../common/CodeInput';
import { toCsv } from '../../domain/stock';
import { Download } from 'lucide-react';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const MovementsView = () => {
  const { movements } = useInventory();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = movements.filter((m) => !q || `${m.itemName} ${m.label} ${m.jobName || ''} ${m.user}`.toLowerCase().includes(q));

  const exportCsv = () => downloadText(`BLP_pohyby_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(movements, [
    { label: 'Čas', value: (m) => fmt(m.timestamp) },
    { label: 'Pohyb', value: 'label' },
    { label: 'Položka', value: 'itemName' },
    { label: 'Kusy', value: 'qty' },
    { label: 'Kód kusu', value: 'unitCode' },
    { label: 'Zakázka', value: 'jobName' },
    { label: 'Poznámka', value: 'note' },
    { label: 'Kdo', value: 'user' },
  ]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat v pohybech…"
          className="flex-1 h-12 px-3 bg-card-bg border border-outline-variant rounded-xl text-base" />
        <button onClick={exportCsv} className="h-12 px-3 rounded-xl border border-outline-variant bg-card-bg text-sm font-semibold flex items-center gap-1.5">
          <Download className="w-5 h-5" /> CSV
        </button>
      </div>
      {visible.length === 0 && <p className="text-base text-on-surface-variant text-center p-6">Zatím žádné pohyby.</p>}
      <ul className="flex flex-col gap-2">
        {visible.map((m) => (
          <li key={m.id} className="bg-card-bg border border-outline-variant rounded-xl p-3">
            <div className="flex justify-between gap-2">
              <span className="font-semibold text-on-surface">{m.itemName}</span>
              <span className={`font-mono font-bold shrink-0 ${['ISSUE', 'RETIRE', 'MISSING', 'TO_SERVICE'].includes(m.type) || m.qty < 0 ? 'text-error' : 'text-secondary'}`}>
                {['ISSUE', 'RETIRE', 'MISSING', 'TO_SERVICE'].includes(m.type) ? '−' : m.qty > 0 ? '+' : ''}{Math.abs(m.qty)} ks
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              {m.label}{m.jobName ? ` · ${m.jobName}` : ''}{m.unitCode ? ` · ${m.unitCode}` : ''}{m.note ? ` · ${m.note}` : ''}
            </p>
            <p className="text-xs text-on-surface-variant">{fmt(m.timestamp)} · {m.user}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const TABS = [
  { id: 'stock', label: 'Stav' },
  { id: 'stocktake', label: 'Inventura' },
  { id: 'movements', label: 'Pohyby' },
  { id: 'catalog', label: 'Katalog' },
];

/** Warehouse: stock levels, stocktake, movement history and the equipment catalog. */
export const WarehouseScreen = () => {
  const { stocktakes, warehouseTab: tab, setWarehouseTab: choose } = useInventory();
  const stocktakeOpen = stocktakes.some((s) => s.status === 'OPEN');

  return (
    <div className="max-w-4xl mx-auto pb-28">
      <div className="sticky top-14 z-30 bg-surface-container border-b border-outline-variant px-3 py-2">
        <div className="flex bg-card-bg p-1 rounded-xl border border-outline-variant" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}
              className={`flex-1 h-11 rounded-lg text-sm font-semibold relative ${tab === t.id ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
              {t.label}
              {t.id === 'stocktake' && stocktakeOpen && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-primary" aria-label="probíhá" />}
            </button>
          ))}
        </div>
      </div>
      {tab === 'catalog' ? <EquipmentCatalog /> : (
        <div className="px-4 pt-4">
          {tab === 'stock' && <StockOverview />}
          {tab === 'stocktake' && <StocktakeView />}
          {tab === 'movements' && <MovementsView />}
        </div>
      )}
    </div>
  );
};
