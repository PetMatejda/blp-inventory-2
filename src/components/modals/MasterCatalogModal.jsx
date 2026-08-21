import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { BookOpen, X, Plus, Edit2, Trash2, Check, Zap, Weight, Image as ImageIcon, Layers, Upload } from 'lucide-react';

const PRESET_PHOTOS = [
  { label: 'SkyPanel S60', url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80' },
  { label: 'Aputure Light', url: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=600&q=80' },
  { label: 'Stativ / C-Stand', url: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&w=600&q=80' },
  { label: 'Káble / Buben', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80' },
  { label: 'Rozvaděč / Power', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80' },
  { label: 'Kufr / Set', url: 'https://images.unsplash.com/photo-1585336261026-870a6d216b54?auto=format&fit=crop&w=600&q=80' },
];

export const MasterCatalogModal = () => {
  const {
    isMasterCatalogModalOpen,
    setIsMasterCatalogModalOpen,
    catalog,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem
  } = useInventory();

  const [editingItem, setEditingItem] = useState(null); // null = list, 'NEW' = create, itemObj = edit
  const [formData, setFormData] = useState({
    name: '',
    category: 'Lights',
    weight: '10 lbs',
    power: '400W',
    image: PRESET_PHOTOS[0].url,
    availableCount: 10,
    isBundle: false,
    bundleItems: [],
  });

  if (!isMasterCatalogModalOpen) return null;

  const handleOpenNew = () => {
    setFormData({
      name: '',
      category: 'Lights',
      weight: '10 lbs',
      power: '400W',
      image: PRESET_PHOTOS[0].url,
      availableCount: 10,
      isBundle: false,
      bundleItems: [
        { name: 'Hlavní jednotka', qty: 1 },
        { name: 'Napájecí zdroj (Ballast)', qty: 1 },
        { name: 'Propojovací kabel 5m', qty: 1 },
      ],
    });
    setEditingItem('NEW');
  };

  const handleOpenEdit = (item) => {
    setFormData({
      name: item.name,
      category: item.category,
      weight: item.weight || '10 lbs',
      power: item.power || 'N/A',
      image: item.image || PRESET_PHOTOS[0].url,
      availableCount: item.availableCount || 10,
      isBundle: !!item.isBundle,
      bundleItems: item.bundleItems ? [...item.bundleItems] : [],
    });
    setEditingItem(item);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddBundleSubItem = () => {
    setFormData({
      ...formData,
      bundleItems: [...formData.bundleItems, { name: '', qty: 1 }],
    });
  };

  const handleUpdateBundleSubItem = (idx, field, value) => {
    const updated = [...formData.bundleItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, bundleItems: updated });
  };

  const handleRemoveBundleSubItem = (idx) => {
    const updated = formData.bundleItems.filter((_, i) => i !== idx);
    setFormData({ ...formData, bundleItems: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingItem === 'NEW') {
      createCatalogItem(formData);
    } else if (editingItem && editingItem.id) {
      updateCatalogItem(editingItem.id, formData);
    }
    setEditingItem(null);
  };

  const handleDelete = (itemId, itemName) => {
    if (window.confirm(`Opravdu chcete smazat položku "${itemName}" z celého katalogu techniky?`)) {
      deleteCatalogItem(itemId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-2xl w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <BookOpen className="w-4 h-4" /> SPRÁVA GLOBÁLNÍHO KATALOGU
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-0.5">
              {editingItem ? (editingItem === 'NEW' ? 'Nová Položka v Katalogu' : 'Úprava Položky Katalogu') : 'Centrální Katalog Techniky'}
            </h2>
          </div>
          <button
            onClick={() => {
              if (editingItem) setEditingItem(null);
              else setIsMasterCatalogModalOpen(false);
            }}
            className="text-outline hover:text-on-surface p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View mode vs Edit/Create mode */}
        {editingItem ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Visual Image Preview & Upload Box */}
            <div className="bg-surface-container p-4 rounded-xl border border-outline-variant flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-28 h-28 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex items-center justify-center shrink-0 relative group">
                <img
                  src={formData.image}
                  alt="Obrázek techniky"
                  className="max-h-full max-w-full object-contain p-1"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = PRESET_PHOTOS[0].url;
                  }}
                />
                <span className="absolute bottom-1 right-1 bg-black/70 text-white p-1 rounded text-[10px]">
                  <ImageIcon className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-2 w-full">
                <label className="block text-xs font-mono text-outline uppercase">Obrázek Techniky (URL nebo Soubor)</label>

                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="Vložte URL obrázku https://..."
                  className="w-full h-10 px-3 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none font-mono"
                />

                <div className="flex flex-wrap gap-2 items-center">
                  <label className="px-3 py-1.5 bg-primary-container text-on-primary-container text-xs font-semibold rounded-lg border border-primary/40 cursor-pointer flex items-center gap-1.5 hover:opacity-90">
                    <Upload className="w-3.5 h-3.5" /> Nahrát z mobilu / PC
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <span className="text-[10px] text-outline">Nebo vyberte vzor:</span>
                </div>

                <div className="flex overflow-x-auto gap-1.5 no-scrollbar pt-1">
                  {PRESET_PHOTOS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, image: p.url })}
                      className={`px-2 py-1 rounded text-[10px] font-mono border whitespace-nowrap ${
                        formData.image === p.url
                          ? 'bg-primary text-on-primary-container border-primary font-bold'
                          : 'bg-surface-container-high text-outline border-outline-variant hover:text-on-surface'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase">Název Techniky / Setu *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Např. ARRI SkyPanel S30-C Set..."
                required
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-outline mb-1 uppercase">Kategorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none font-bold"
                >
                  <option value="Lights">💡 Světla</option>
                  <option value="Ballasts">⚡ Balasty & Zdroje</option>
                  <option value="Textiles">🧵 Textil & Difúze</option>
                  <option value="Cables">🔌 Kábly</option>
                  <option value="Distribution">📻 Distribuce & Power</option>
                  <option value="Grip">⚓ Stativy & Grip</option>
                  <option value="Kits">📦 Sety & Balíčky</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-outline mb-1 uppercase">Počet k dispozici (ks)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.availableCount}
                  onChange={(e) => setFormData({ ...formData, availableCount: parseInt(e.target.value) || 1 })}
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-outline mb-1 uppercase">Hmotnost</label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="Např. 25 lbs"
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-outline mb-1 uppercase">Příkon / Výkon</label>
                <input
                  type="text"
                  value={formData.power}
                  onChange={(e) => setFormData({ ...formData, power: e.target.value })}
                  placeholder="Např. 400W"
                  className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Set / Kit / Bundle Items Toggle & Editor */}
            <div className="bg-surface-container p-4 rounded-xl border border-outline-variant flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isBundle}
                  onChange={(e) => setFormData({ ...formData, isBundle: e.target.checked })}
                  className="w-5 h-5 rounded text-primary focus:ring-primary bg-surface-container-high border-outline-variant"
                />
                <div>
                  <span className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" /> Jedná se o Set / Balíček techniky (Kit)
                  </span>
                  <span className="text-xs text-outline block">Obsahuje více pod-položek, které se vkládají najednou</span>
                </div>
              </label>

              {formData.isBundle && (
                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/60">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-primary uppercase">Složení Setu (Pod-položky):</span>
                    <button
                      type="button"
                      onClick={handleAddBundleSubItem}
                      className="px-2.5 py-1 bg-primary text-on-primary-container text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Přidat do setu
                    </button>
                  </div>

                  {formData.bundleItems.length === 0 ? (
                    <div className="text-xs text-outline text-center py-3 italic">
                      Zatím žádné pod-položky. Klikněte na "+ Přidat do setu".
                    </div>
                  ) : (
                    formData.bundleItems.map((sub, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => handleUpdateBundleSubItem(idx, 'name', e.target.value)}
                          placeholder="Název dílu (např. Kabel 5m, Zdroj...)"
                          className="flex-1 h-10 px-3 bg-card-bg border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none"
                          required
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={sub.qty}
                            onChange={(e) => handleUpdateBundleSubItem(idx, 'qty', parseInt(e.target.value) || 1)}
                            className="w-16 h-10 px-2 bg-card-bg border border-outline-variant rounded-lg text-xs font-mono font-bold text-on-surface text-center focus:outline-none"
                          />
                          <span className="text-xs font-mono text-outline">ks</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBundleSubItem(idx)}
                          className="p-2 text-outline hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
              >
                Storno
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow"
              >
                <Check className="w-4 h-4" /> Uložit do Katalogu
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleOpenNew}
              className="w-full py-3 bg-primary text-on-primary-container font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow hover:opacity-90 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> + Vytvořit Novou Položku v Katalogu
            </button>

            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
              {catalog.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center bg-surface-container p-3 rounded-xl border border-outline-variant hover:border-outline transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 truncate">
                    <img src={item.image} alt={item.name} className="w-12 h-12 object-contain bg-surface-container-lowest rounded-lg p-1 shrink-0" />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-on-surface truncate">{item.name}</h4>
                        {item.isBundle && (
                          <span className="px-1.5 py-0.5 bg-primary-container text-on-primary-container text-[10px] font-mono font-bold rounded">
                            SET
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-outline font-mono">
                        {item.category} • {item.weight} • {item.power}
                        {item.isBundle && ` • ${item.bundleItems?.length || 0} pod-položek`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 text-primary hover:bg-surface-variant rounded-lg border border-outline-variant"
                      title="Upravit položku / set"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-2 text-error hover:bg-error-container/30 rounded-lg border border-outline-variant"
                      title="Smazat z katalogu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsMasterCatalogModalOpen(false)}
              className="w-full py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm mt-2"
            >
              Zavřít
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
