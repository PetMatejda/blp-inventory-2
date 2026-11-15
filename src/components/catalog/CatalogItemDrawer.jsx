import React, { useState, useEffect, useRef } from 'react';
import { useBackLayer } from '../../hooks/useBackLayer';
import { useInventory } from '../../context/InventoryContext';
import { CATEGORIES, ITEM_ICONS, getCategoryMeta, getItemMeta } from '../../utils/categoryIcons';

/** Icon of the equipment type; "Kategorie" = the category icon. */
const IconPicker = ({ value, category, onChange }) => {
  const meta = getCategoryMeta(category);
  const options = [{ id: '', label: `Podle kategorie (${meta.label})`, icon: meta.icon }, ...ITEM_ICONS];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const Icon = o.icon;
        const active = (value || '') === o.id;
        return (
          <button key={o.id || 'category'} type="button" title={o.label} aria-label={o.label} aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center active:scale-95 ${active ? meta.color + ' ring-2 ring-primary' : 'border-outline-variant bg-surface-container text-on-surface-variant'}`}>
            <Icon className="w-5 h-5" />
          </button>
        );
      })}
    </div>
  );
};
import {
  X, Check, Plus, Trash2, Layers,
  Weight, Zap, Package, Camera, Search, QrCode
} from 'lucide-react';
// html5-qrcode is loaded on demand (see startBarcodeScanner).
import { useDialogs } from '../common/Dialogs';

const CategoryBadge = ({ category, icon }) => {
  const meta = getItemMeta({ category, icon });
  const Icon = meta.icon;
  return <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></span>;
};

const EMPTY_FORM = {
  name: '',
  category: 'Lights',
  weight: '',
  power: '',
  size: '',
  brand: '',
  usage: '',
  icon: '',
  barcode: '',
  serialPrefix: 'EQP',
  image: '',
  availableCount: 1,
  isBundle: false,
  bundleItems: [],
};

export const CatalogItemDrawer = ({ item, onClose }) => {
  const { createCatalogItem, updateCatalogItem, catalog } = useInventory();
  const { confirm } = useDialogs();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isDirty, setIsDirty] = useState(false);

  // Barcode Camera Scanner state
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const barcodeScannerRef = useRef(null);

  // Bundle item picker state
  const [showBundlePicker, setShowBundlePicker] = useState(false);
  const [bundleSearch, setBundleSearch] = useState('');
  const pickerRef = useRef(null);

  const isNew = item === 'NEW';
  const isEditing = item && item !== 'NEW';

  useEffect(() => {
    if (!item) return;
    if (isNew) {
      setFormData({ ...EMPTY_FORM, bundleItems: [] });
    } else {
      setFormData({
        name: item.name || '',
        category: item.category || 'Lights',
        weight: item.weight || '',
        power: item.power || '',
        size: item.size || '',
        brand: item.brand || '',
        usage: item.usage || '',
        icon: item.icon || '',
        barcode: item.barcode || '',
        serialPrefix: item.serialPrefix || 'EQP',
        image: '',
        availableCount: parseInt(item.availableCount) || 1,
        isBundle: !!item.isBundle,
        bundleItems: item.bundleItems ? [...item.bundleItems] : [],
      });
    }
    setIsDirty(false);
    setShowBundlePicker(false);
    setBundleSearch('');
    stopBarcodeScanner();
  }, [item]);

  const set = (patch) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };


  // Barcode Scanner in Drawer
  const startBarcodeScanner = async () => {
    setIsScanningBarcode(true);
    setTimeout(async () => {
      try {
        const scannerId = "drawer-barcode-reader";
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode(scannerId);
        barcodeScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 160 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            set({ barcode: decodedText });
            stopBarcodeScanner();
          },
          () => {}
        );
      } catch (err) {
        console.warn('Barcode scan error in drawer:', err);
        setIsScanningBarcode(false);
      }
    }, 100);
  };

  const stopBarcodeScanner = () => {
    if (barcodeScannerRef.current) {
      try {
        if (barcodeScannerRef.current.isScanning) {
          barcodeScannerRef.current.stop().then(() => {
            barcodeScannerRef.current?.clear();
            barcodeScannerRef.current = null;
          }).catch(() => {});
        } else {
          barcodeScannerRef.current.clear();
          barcodeScannerRef.current = null;
        }
      } catch (e) {}
    }
    setIsScanningBarcode(false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    // Catalog items no longer carry photos — category icons are used instead.
    stopBarcodeScanner();
    if (isNew) {
      createCatalogItem(formData);
    } else if (isEditing) {
      updateCatalogItem(item.id, formData);
    }
    onClose();
  };

  const handleClose = async () => {
    stopBarcodeScanner();
    if (isDirty && !(await confirm({
      title: 'Zahodit změny?',
      message: 'Úpravy této položky katalogu nejsou uložené.',
      confirmLabel: 'Zahodit',
      cancelLabel: 'Pokračovat v úpravách',
      danger: true,
    }))) return;
    onClose();
  };

  // Bundle sub-item helpers
  const addBundleItemFromCatalog = (catalogItem) => {
    const existing = formData.bundleItems.find(b => b.catalogId === catalogItem.id);
    if (existing) {
      const updated = formData.bundleItems.map(b =>
        b.catalogId === catalogItem.id ? { ...b, qty: b.qty + 1 } : b
      );
      set({ bundleItems: updated });
    } else {
      set({
        bundleItems: [...formData.bundleItems, {
          catalogId: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          qty: 1,
        }],
      });
    }
    setShowBundlePicker(false);
    setBundleSearch('');
  };

  const updateBundleItemQty = (idx, qty) => {
    const updated = [...formData.bundleItems];
    updated[idx] = { ...updated[idx], qty: Math.max(1, qty) };
    set({ bundleItems: updated });
  };

  const removeBundleItem = (idx) => set({ bundleItems: formData.bundleItems.filter((_, i) => i !== idx) });

  const currentItemId = isEditing ? item.id : null;
  const bundleCatalogIds = new Set(formData.bundleItems.map(b => b.catalogId));
  const availableForBundle = (catalog || []).filter(c => {
    if (c.id === currentItemId) return false;
    if (c.isBundle) return false;
    const search = bundleSearch.toLowerCase();
    if (search && !c.name.toLowerCase().includes(search) && !(c.category || '').toLowerCase().includes(search)) return false;
    return true;
  });

  useEffect(() => {
    if (!showBundlePicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowBundlePicker(false);
        setBundleSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBundlePicker]);

  useBackLayer(!!item, handleClose);

  if (!item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:max-w-md bg-card-bg border-l border-outline-variant shadow-2xl
                      overflow-hidden animate-sheet-up
                      max-sm:inset-x-0 max-sm:inset-y-auto max-sm:bottom-0 max-sm:rounded-t-3xl max-sm:border-t max-sm:border-l-0
                      max-sm:max-h-[92dvh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0 bg-surface-container">
          <h2 className="font-bold text-base text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {isNew ? 'Nová Položka Katalogu' : `Upravit: ${formData.name}`}
          </h2>
          <button onClick={handleClose} aria-label="Zavřít" className="w-11 h-11 -mr-2 flex items-center justify-center hover:bg-surface-variant rounded-full text-outline">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Basic Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-outline mb-1 uppercase">Název položky</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="např. SkyPanel S60-C nebo Aputure 600d"
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-outline mb-1 uppercase">Kategorie</label>
              <select
                value={formData.category}
                onChange={(e) => set({ category: e.target.value })}
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-bold focus:outline-none focus:border-primary"
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

            </div>

            <div>
              <label className="block text-xs font-bold text-outline mb-1 uppercase">Ikona</label>
              <IconPicker value={formData.icon} category={formData.category} onChange={(icon) => set({ icon })} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[['size', 'Velikost', '8x6 m'], ['brand', 'Výrobce', 'Inteca'], ['usage', 'Použití', 'Cloud 8x6']].map(([key, label, ph]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-outline mb-1 uppercase">{label}</label>
                  <input type="text" value={formData[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder={ph}
                    className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>

            {/* Barcode / EAN / QR input with Camera Scan capability */}
            <div className="bg-surface-container/60 border border-outline-variant/80 rounded-2xl p-3">
              <label className="block text-xs font-bold text-outline mb-1 uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-secondary" /> Čárový kód / Barcode (nepovinný)
                </span>
                {formData.barcode && (
                  <span className="text-xs text-secondary font-mono">Uloženo</span>
                )}
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => set({ barcode: e.target.value })}
                  placeholder="Zadejte EAN / čárový kód..."
                  className="flex-1 h-10 px-3 bg-card-bg border border-outline-variant rounded-xl text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isScanningBarcode) {
                      stopBarcodeScanner();
                    } else {
                      startBarcodeScanner();
                    }
                  }}
                  className={`px-3 h-10 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow ${
                    isScanningBarcode
                      ? 'bg-error text-on-error'
                      : 'bg-primary text-on-primary'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isScanningBarcode ? 'Zavřít kameru' : 'Vyfotit / Sken'}
                </button>
              </div>

              {/* Inline Camera Reader for Barcode */}
              {isScanningBarcode && (
                <div className="mt-2.5 rounded-xl overflow-hidden border border-primary/50 bg-black relative">
                  <div id="drawer-barcode-reader" className="w-full min-h-[160px]" />
                  <div className="p-2 bg-black/80 text-center text-xs text-secondary font-mono">
                    Zaměřte kameru na čárový kód techniky...
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-outline mb-1 uppercase flex items-center gap-1">
                  <Weight className="w-3 h-3" /> Hmotnost
                </label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => set({ weight: e.target.value })}
                  placeholder="5 kg"
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-outline mb-1 uppercase flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Příkon
                </label>
                <input
                  type="text"
                  value={formData.power}
                  onChange={(e) => set({ power: e.target.value })}
                  placeholder="800W"
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-outline mb-1 uppercase flex items-center gap-1">
                  <Package className="w-3 h-3" /> Ks sklad
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.availableCount}
                  onChange={(e) => set({ availableCount: parseInt(e.target.value) || 0 })}
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-mono font-bold text-on-surface focus:outline-none focus:border-primary text-center"
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
                  <span className="text-xs text-outline">Složení z existujících položek katalogu</span>
                </div>
              </label>

              {formData.isBundle && (
                <div className="mt-4 flex flex-col gap-2 pt-3 border-t border-primary/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono font-bold text-primary uppercase">Složení setu</span>
                    <div className="relative" ref={pickerRef}>
                      <button
                        type="button"
                        onClick={() => { setShowBundlePicker(!showBundlePicker); setBundleSearch(''); }}
                        className="px-2.5 py-1 bg-primary text-on-primary text-xs font-bold rounded-lg flex items-center gap-1 active:scale-90"
                      >
                        <Plus className="w-3 h-3" /> Přidat z katalogu
                      </button>

                      {showBundlePicker && (
                        <div className="absolute right-0 top-full mt-1 w-72 max-h-64 bg-card-bg border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                          <div className="p-2 border-b border-outline-variant flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-outline shrink-0" />
                            <input
                              type="text"
                              value={bundleSearch}
                              onChange={(e) => setBundleSearch(e.target.value)}
                              placeholder="Hledat v katalogu..."
                              className="flex-1 text-xs bg-transparent text-on-surface outline-none placeholder:text-outline"
                              autoFocus
                            />
                          </div>
                          <div className="overflow-y-auto flex-1">
                            {availableForBundle.length === 0 ? (
                              <p className="text-xs text-outline text-center py-4 italic">
                                {bundleSearch ? 'Žádná shoda' : 'Žádné dostupné položky'}
                              </p>
                            ) : (
                              availableForBundle.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => addBundleItemFromCatalog(c)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-container transition-colors ${
                                    bundleCatalogIds.has(c.id) ? 'bg-primary/5' : ''
                                  }`}
                                >
                                  <CategoryBadge category={c.category} icon={c.icon} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-on-surface truncate">{c.name}</div>
                                    <div className="text-xs text-outline">{c.category}</div>
                                  </div>
                                  {bundleCatalogIds.has(c.id) && (
                                    <span className="text-xs font-mono text-primary font-bold shrink-0">✓ v setu</span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {formData.bundleItems.length === 0 ? (
                    <p className="text-xs text-outline italic text-center py-3">
                      Zatím žádné díly. Klikněte „Přidat z katalogu".
                    </p>
                  ) : (
                    formData.bundleItems.map((sub, idx) => (
                      <div key={sub.catalogId || idx} className="flex items-center gap-2 bg-surface-container/50 rounded-xl px-2 py-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-on-surface truncate">{sub.name}</div>
                          {sub.category && <div className="text-xs text-outline">{sub.category}</div>}
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={sub.qty}
                          onChange={(e) => updateBundleItemQty(idx, parseInt(e.target.value) || 1)}
                          className="w-12 h-8 px-1 bg-card-bg border border-outline-variant rounded-lg text-xs font-mono font-bold text-center focus:outline-none"
                        />
                        <span className="text-xs text-outline shrink-0">ks</span>
                        <button
                          type="button"
                          onClick={() => removeBundleItem(idx)}
                          className="p-1.5 text-outline hover:text-error hover:bg-error-container/20 rounded-lg transition-colors active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-outline-variant bg-surface-container shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 bg-surface-variant text-on-surface-variant font-bold rounded-xl text-sm border border-outline-variant active:scale-95"
          >
            Zrušit
          </button>
          <button
            type="submit"
            onClick={handleSave}
            disabled={!formData.name.trim()}
            className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-xl text-sm shadow flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> {isNew ? 'Vytvořit' : 'Uložit'}
          </button>
        </div>
      </div>
    </>
  );
};
