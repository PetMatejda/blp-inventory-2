import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CATEGORIES } from '../../utils/categoryIcons';
import {
  X, Check, Plus, Trash2, Layers, Upload, Image as ImageIcon,
  Weight, Zap, Package, ChevronDown, Camera, Search, QrCode
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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
  barcode: '',
  serialPrefix: 'EQP',
  image: PRESET_PHOTOS[0].url,
  availableCount: 1,
  isBundle: false,
  bundleItems: [],
};

export const CatalogItemDrawer = ({ item, onClose }) => {
  const { createCatalogItem, updateCatalogItem, catalog } = useInventory();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showPresets, setShowPresets] = useState(false);
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
        barcode: item.barcode || '',
        serialPrefix: item.serialPrefix || 'EQP',
        image: item.image || PRESET_PHOTOS[0].url,
        availableCount: parseInt(item.availableCount) || 1,
        isBundle: !!item.isBundle,
        bundleItems: item.bundleItems ? [...item.bundleItems] : [],
      });
    }
    setIsDirty(false);
    setShowPresets(false);
    setShowBundlePicker(false);
    setBundleSearch('');
    stopBarcodeScanner();
  }, [item]);

  const set = (patch) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set({ image: reader.result });
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set({ image: reader.result });
    reader.readAsDataURL(file);
  };

  // Barcode Scanner in Drawer
  const startBarcodeScanner = async () => {
    setIsScanningBarcode(true);
    setTimeout(async () => {
      try {
        const scannerId = "drawer-barcode-reader";
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
    stopBarcodeScanner();
    if (isNew) {
      createCatalogItem(formData);
    } else if (isEditing) {
      updateCatalogItem(item.id, formData);
    }
    onClose();
  };

  const handleClose = () => {
    stopBarcodeScanner();
    if (isDirty && !window.confirm('Máte neuložené změny. Zavřít bez uložení?')) return;
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
          image: catalogItem.image,
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
                      overflow-hidden animate-in slide-in-from-right duration-300
                      max-sm:inset-x-0 max-sm:inset-y-auto max-sm:bottom-0 max-sm:rounded-t-3xl max-sm:border-t max-sm:border-l-0
                      max-sm:max-h-[92vh] max-sm:animate-in max-sm:slide-in-from-bottom"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0 bg-surface-container">
          <h2 className="font-bold text-base text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {isNew ? 'Nová Položka Katalogu' : `Upravit: ${formData.name}`}
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-surface-variant rounded-full text-outline">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Photo */}
          <div className="flex gap-4 items-start">
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-outline-variant bg-surface-container shrink-0 group">
              <img
                src={formData.image}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = PRESET_PHOTOS[0].url; }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="flex items-center gap-1.5 text-xs text-primary font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Nahrát foto
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-secondary font-bold cursor-pointer">
                <Camera className="w-3.5 h-3.5" /> Vyfotit techniku
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
              </label>
              <button
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="flex items-center gap-1 text-[10px] text-outline hover:text-on-surface"
              >
                <ChevronDown className="w-3 h-3" /> Předvolby fotek
              </button>
              {showPresets && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {PRESET_PHOTOS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { set({ image: p.url }); setShowPresets(false); }}
                      className="w-10 h-10 rounded-lg overflow-hidden border border-outline-variant hover:border-primary transition-colors"
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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

            {/* Barcode / EAN / QR input with Camera Scan capability */}
            <div className="bg-surface-container/60 border border-outline-variant/80 rounded-2xl p-3">
              <label className="block text-xs font-bold text-outline mb-1 uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-secondary" /> Čárový kód / Barcode (nepovinný)
                </span>
                {formData.barcode && (
                  <span className="text-[10px] text-secondary font-mono">Uloženo</span>
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
                      ? 'bg-error text-white'
                      : 'bg-primary text-on-primary-container'
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
                  <div className="p-2 bg-black/80 text-center text-[11px] text-secondary font-mono">
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
                        className="px-2.5 py-1 bg-primary text-on-primary-container text-xs font-bold rounded-lg flex items-center gap-1 active:scale-90"
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
                                  <img
                                    src={c.image}
                                    alt={c.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-outline-variant shrink-0"
                                    onError={(e) => { e.target.src = PRESET_PHOTOS[0].url; }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-on-surface truncate">{c.name}</div>
                                    <div className="text-[10px] text-outline">{c.category}</div>
                                  </div>
                                  {bundleCatalogIds.has(c.id) && (
                                    <span className="text-[10px] font-mono text-primary font-bold shrink-0">✓ v setu</span>
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
                        {sub.image && (
                          <img
                            src={sub.image}
                            alt={sub.name}
                            className="w-8 h-8 rounded-lg object-cover border border-outline-variant shrink-0"
                            onError={(e) => { e.target.src = PRESET_PHOTOS[0].url; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-on-surface truncate">{sub.name}</div>
                          {sub.category && <div className="text-[10px] text-outline">{sub.category}</div>}
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={sub.qty}
                          onChange={(e) => updateBundleItemQty(idx, parseInt(e.target.value) || 1)}
                          className="w-12 h-8 px-1 bg-card-bg border border-outline-variant rounded-lg text-xs font-mono font-bold text-center focus:outline-none"
                        />
                        <span className="text-[10px] text-outline shrink-0">ks</span>
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
            className="flex-1 py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm shadow flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> {isNew ? 'Vytvořit' : 'Uložit'}
          </button>
        </div>
      </div>
    </>
  );
};
