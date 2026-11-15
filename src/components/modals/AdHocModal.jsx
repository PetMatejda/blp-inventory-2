import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Plus, Minus } from 'lucide-react';
import { Sheet } from '../common/Dialogs';
import { Field, inputCls, SheetButtons } from '../common/FormField';

export const AdHocModal = () => {
  const { isAdHocModalOpen, setIsAdHocModalOpen, addAdHocItem } = useInventory();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Grip');
  const [quantity, setQuantity] = useState(1);

  if (!isAdHocModalOpen) return null;

  const close = () => setIsAdHocModalOpen(false);
  const clamp = (n) => Math.max(1, Math.min(99, n));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    addAdHocItem(name, category, quantity);
    setName('');
    setQuantity(1);
  };

  return (
    <Sheet
      title="Vlastní položka"
      subtitle="Technika, která není v katalogu"
      onClose={close}
      dismissOnBackdrop={false}
      footer={<SheetButtons onCancel={close} form="adhoc-form" submitLabel="Vložit položku" icon={Plus} tone="secondary" />}
    >
      <form id="adhoc-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Název techniky / nářadí" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. žebřík 3dílný, aku utahovák…"
            required
            autoFocus
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            className={inputCls}
          />
        </Field>

        <Field label="Kategorie">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="Lights">Světla</option>
            <option value="Stands">Stativy</option>
            <option value="Cables">Kabely</option>
            <option value="Distribution">Distribuce</option>
            <option value="Grip">Grip</option>
          </select>
        </Field>

        <div>
          <span className="block text-sm font-semibold text-on-surface-variant mb-1.5">Počet kusů</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQuantity((q) => clamp(q - 1))} disabled={quantity <= 1} aria-label="Méně kusů"
              className="w-14 h-14 rounded-xl border border-outline-variant bg-surface-container flex items-center justify-center disabled:opacity-30 active:scale-90">
              <Minus className="w-6 h-6" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="99"
              value={quantity}
              onChange={(e) => setQuantity(clamp(parseInt(e.target.value, 10) || 1))}
              aria-label="Počet kusů"
              className={`${inputCls} h-14 flex-1 text-center font-mono font-bold text-2xl`}
            />
            <button type="button" onClick={() => setQuantity((q) => clamp(q + 1))} aria-label="Více kusů"
              className="w-14 h-14 rounded-xl border border-outline-variant bg-surface-container flex items-center justify-center active:scale-90">
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </form>
    </Sheet>
  );
};
