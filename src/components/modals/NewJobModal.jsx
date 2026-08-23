import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Plus, X, Calendar } from 'lucide-react';

export const NewJobModal = () => {
  const { isNewJobModalOpen, setIsNewJobModalOpen, createJob } = useInventory();

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [blpResponsible, setBlpResponsible] = useState('Marek Radolf');
  const [gaffer, setGaffer] = useState('Petr M.');
  const [riggingDate, setRiggingDate] = useState(new Date().toISOString().split('T')[0]);
  const [deriggingDate, setDeriggingDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isNewJobModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    createJob({
      name,
      client,
      blpResponsible,
      assignedGaffer: gaffer,
      riggingDate,
      deriggingDate,
      vehicleIds: ['v1'],
    });
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase">ZAKLÁDÁNÍ ZAKÁZKY</span>
            <h2 className="text-xl font-bold text-on-surface">Nová Natáčecí Zakázka (Job)</h2>
          </div>
          <button
            onClick={() => setIsNewJobModalOpen(false)}
            className="text-outline hover:text-on-surface p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-mono text-outline mb-1 uppercase">Název Zakázky *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Reklama Hyundai - Den 1"
              required
              className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-outline mb-1 uppercase">Klient / Produkce</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Např. Stillking Films"
              className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase">Zodpovědný za BLP</label>
              <input
                type="text"
                value={blpResponsible}
                onChange={(e) => setBlpResponsible(e.target.value)}
                placeholder="Např. Marek Radolf, Petr M."
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase">Odpovědný Gaffer (Štáb)</label>
              <input
                type="text"
                value={gaffer}
                onChange={(e) => setGaffer(e.target.value)}
                placeholder="Např. Petr M."
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>


          {/* Rigging & Derigging Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-secondary" /> Datum Rigging
              </label>
              <input
                type="date"
                value={riggingDate}
                onChange={(e) => setRiggingDate(e.target.value)}
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-outline mb-1 uppercase flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-tertiary" /> Datum Derigging (Vracení)
              </label>
              <input
                type="date"
                value={deriggingDate}
                onChange={(e) => setDeriggingDate(e.target.value)}
                className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface font-mono focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsNewJobModalOpen(false)}
              className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
            >
              Storno
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" /> Vytvořit Zakázku
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
