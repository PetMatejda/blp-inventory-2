import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Plus, X } from 'lucide-react';

export const AdHocModal = () => {
  const { isAdHocModalOpen, setIsAdHocModalOpen, addAdHocItem } = useInventory();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Grip');
  const [quantity, setQuantity] = useState(1);

  if (!isAdHocModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    addAdHocItem(name, category, quantity);
    setName('');
    setQuantity(1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-secondary uppercase">AD-HOC POLOŽKA</span>
            <h2 className="text-xl font-bold text-on-surface">Vložit Nestandardní Zařízení</h2>
          </div>
          <button onClick={() => setIsAdHocModalOpen(false)} className="text-outline hover:text-on-surface p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-mono text-outline mb-1 uppercase">Název Techniky / Nářadí *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Externí žebřík 3-díl, Aku utahovák..."
              required
              className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none"
              >
                <option value="Lights">Světla</option>
                <option value="Stands">Stativy</option>
                <option value="Cables">Kábly</option>
                <option value="Distribution">Distribuce</option>
                <option value="Grip">Grip</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase">Požadovaný Počet (ks)</label>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsAdHocModalOpen(false)}
              className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
            >
              Storno
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-secondary text-on-secondary-container font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" /> Vložit Položku
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
