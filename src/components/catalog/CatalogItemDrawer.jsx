import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CATEGORIES } from '../../utils/categoryIcons';
import {
  X, Check, Plus, Trash2, Layers, Upload, Image as ImageIcon,
  Weight, Zap, Package, ChevronDown
} from 'lucide-react';

const PRESET_PHOTOS = [
  { label: 'SkyPanel', url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80' },
  { label: 'Aputure', url: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=600&q=80' },
  { label: 'C-Stand', url: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&w=600&q=80' },
  { label: 'Kabel', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80' },
  { label: 'Power', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80' },
  { label: 'Case/Set', url: 'https://images.unsplash.com/photo-1585336261026-870a6d216b54?auto=format&fit=crop&w=600&q=80' },
];

const EMPTY_FORM = {
  name: '',
  category: 'Lights',
  weight: '',
  power: '',
  image: PRESET_PHOTOS[0].url,
  availableCount: 1,
  isBundle: false,
  bundleItems: [],
};

/**
 * CatalogItemDrawer
 * 
 * A slide-in side panel (right on desktop, bottom sheet on mobile) for
 * creating or editing a catalog item. Replaces the old MasterCatalogModal.
 *
 * Props:
 *   item  — null (hidden) | 'NEW' | catalogItemObject
 *   onClose — callback to hide the drawer
 */
export const CatalogItemDrawer = ({ item, onClose }) => {
  const { createCatalogItem, updateCatalogItem } = useInventory();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showPresets, setShowPresets] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const isNew = item === 'NEW';
  const isOpen = item !== null;

  // Populate form when item changes
  useEffect(() => {
    if (!isOpen) return;
    if (isNew) {
      setFormData({ ...EMPTY_FORM, bundleItems: [] });
    } else if (item && item.id) {
      setFormData({
        name: item.name || '',
        category: item.category || 'Lights',
        weight: item.weight || '',
        power: item.power || '',
        image: item.image || PRESET_PHOTOS[0].url,
        availableCount: item.availableCount || 1,
        isBundle: !!item.isBundle,
        bundleItems: item.bundleItems ? [...item.bundleItems] : [],
      });
    }
    setIsDirty(false);
    setShowPresets(false);
  }, [item]);

  if (!isOpen) return null;

  const set = (patch) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set({ image: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (isNew) {
      createCatalogItem(formData);
    } else {
      updateCatalogItem(item.id, formData);
    }
    onClose();
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('Máte neuložené změny. Zavřít bez uložení?')) return;
    onClose();
  };

  // Bundle sub-item helpers
  const addBundleItem = () => set({ bundleItems: [...formData.bundleItems, { name: '', qty: 1 }] });
  const updateBundleItem = (idx, field, value) => {
    const updated = [...formData.bundleItems];
    updated[idx] = { ...updated[idx], [field]: value };
    set({ bundleItems: updated });
  };
  const removeBundleItem = (idx) => set({ bundleItems: formData.bundleItems.filter((_, i) => i !== idx) });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Drawer — slides from right on md+, from bottom on mobile */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:max-w-md bg-card-bg border-l border-outline-variant shadow-2xl
                      animate-in slide-in-from-right duration-300
                      max-sm:inset-x-0 max-sm:inset-y-auto max-sm:bottom-0 max-sm:rounded-t-3xl max-sm:border-t max-sm:border-l-0
                      max-sm:slide-in-from-bottom">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-outline-variant rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0">
          <div>
            <p className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
              {isNew ? 'Nová položka' : 'Upravit položku'}
            </p>
            <h2 className="text-lg font-bold text-on-surface mt-0.5 leading-tight">
              {isNew ? 'Přidat do katalogu' : (formData.name || 'Bez názvu')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-outline hover:text-on-surface hover:bg-surface-container rounded-xl transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form — scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 flex flex-col gap-5">

            {/* ── Image picker ── */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono font-bold text-outline uppercase tracking-wide">Obrázek</label>

              {/* Preview + upload */}
              <div className="flex gap-3 items-center">
                <div className="w-20 h-20 rounded-2xl border-2 border-outline-variant overflow-hidden bg-surface-container-lowest shrink-0 flex items-center justify-center">
                  {formData.image ? (
                    <img
                      src={formData.image}
                      alt="Náhled"
                      className="w-full h-full object-contain p-1"
                      onError={(e) => { e.target.src = PRESET_PHOTOS[0].url; }}
                    />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-outline/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="px-3 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2 transition-all active:scale-95">
                    <Upload className="w-3.5 h-3.5" /> Nahrát z mobilu / PC
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPresets(!showPresets)}
                    className="px-3 py-2 bg-surface-container border border-outline-variant text-outline text-xs font-semibold rounded-xl flex items-center gap-2 active:scale-95"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Vzorové foto
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* URL input */}
              <input
                type="text"
                value={formData.image}
                onChange={(e) => set({ image: e.target.value })}
                placeholder="https://... URL obrázku"
                className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-xs text-on-surface font-mono focus:border-primary focus:outline-none"
              />

              {/* Preset grid */}
              {showPresets && (
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_PHOTOS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { set({ image: p.url }); setShowPresets(false); }}
                      className={`relative rounded-xl overflow-hidden border-2 aspect-square transition-all ${
                        formData.image === p.url ? 'border-primary' : 'border-outline-variant'
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 text-[9px] font-mono font-bold text-center bg-black/60 text-white py-0.5 truncate px-1">
                        {p.label}
                      </span>
                      {formData.image === p.url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Name ── */}
            <div>
              <label className="text-xs font-mono font-bold text-outline uppercase tracking-wide block mb-1.5">
                Název <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Např. ARRI SkyPanel S60-C"
                required
                autoFocus
                className="w-full h-12 px-4 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* ── Category + Count ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-bold text-outline uppercase tracking-wide block mb-1.5">Kategorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => set({ category: e.target.value })}
                  className="w-full h-12 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-semibold focus:outline-none focus:border-primary"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-outline uppercase tracking-wide block mb-1.5">Počet ks</label>
                <input
                  type="number"
                  min="1"
                  value={formData.availableCount}
                  onChange={(e) => set({ availableCount: parseInt(e.target.value) || 1 })}
                  className="w-full h-12 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono font-bold text-center focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* ── Weight + Power ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-bold text-outline uppercase tracking-wide flex items-center gap-1 mb-1.5">
                  <Weight className="w-3 h-3" /> Hmotnost
                </label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => set({ weight: e.target.value })}
                  placeholder="25 lbs"
                  className="w-full h-12 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-outline uppercase tracking-wide flex items-center gap-1 mb-1.5">
                  <Zap className="w-3 h-3 text-tertiary" /> Příkon
                </label>
                <input
                  type="text"
                  value={formData.power}
                  onChange={(e) => set({ power: e.target.value })}
                  placeholder="400W"
                  className="w-full h-12 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* ── Bundle / Set section ── */}
            <div className={`rounded-2xl border p-4 transition-colors ${
              formData.isBundle ? 'bg-primary-container/10 border-primary/40' : 'bg-surface-container border-outline-variant'
            }`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => set({ isBundle: !formData.isBundle })}
                  className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${
                    formData.isBundle ? 'bg-primary' : 'bg-outline-variant'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    formData.isBundle ? 'translate-x-5.5 left-0.5' : 'translate-x-0.5 left-0.5'
                  }`} />
                </div>
                <div>
                  <span className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" /> Jedná se o Set / Balíček
                  </span>
                  <span className="text-xs text-outline">Obsahuje více dílů vkládaných najednou</span>
                </div>
              </label>

              {formData.isBundle && (
                <div className="mt-4 flex flex-col gap-2 pt-3 border-t border-primary/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono font-bold text-primary uppercase">Složení setu</span>
                    <button
                      type="button"
                      onClick={addBundleItem}
                      className="px-2.5 py-1 bg-primary text-on-primary-container text-xs font-bold rounded-lg flex items-center gap-1 active:scale-90"
                    >
                      <Plus className="w-3 h-3" /> Přidat díl
                    </button>
                  </div>

                  {formData.bundleItems.length === 0 ? (
                    <p className="text-xs text-outline italic text-center py-3">
                      Zatím žádné díly. Klikněte „Přidat díl".
                    </p>
                  ) : (
                    formData.bundleItems.map((sub, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => updateBundleItem(idx, 'name', e.target.value)}
                          placeholder="Název dílu..."
                          className="flex-1 h-10 px-3 bg-card-bg border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                          required
                        />
                        <input
                          type="number"
                          min="1"
                          value={sub.qty}
                          onChange={(e) => updateBundleItem(idx, 'qty', parseInt(e.target.value) || 1)}
                          className="w-14 h-10 px-2 bg-card-bg border border-outline-variant rounded-xl text-xs font-mono font-bold text-center focus:outline-none"
                        />
                        <span className="text-xs text-outline shrink-0">ks</span>
                        <button
                          type="button"
                          onClick={() => removeBundleItem(idx)}
                          className="p-2 text-outline hover:text-error hover:bg-error-container/20 rounded-xl transition-colors active:scale-90"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer — sticky save/cancel */}
        <div className="px-5 py-4 border-t border-outline-variant bg-card-bg shrink-0 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-2xl text-sm active:scale-95 transition-all"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form="catalog-form"
            onClick={handleSubmit}
            className="flex-1 py-3 bg-primary text-on-primary-container font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50"
            disabled={!formData.name.trim()}
          >
            <Check className="w-4 h-4" />
            {isNew ? 'Vytvořit' : 'Uložit změny'}
          </button>
        </div>
      </div>
    </>
  );
};
