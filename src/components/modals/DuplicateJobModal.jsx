import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Copy, X, Calendar } from 'lucide-react';

export const DuplicateJobModal = () => {
  const { templateJob, setTemplateJob, duplicateJobAsTemplate } = useInventory();

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [gaffer, setGaffer] = useState('Petr M.');
  const [riggingDate, setRiggingDate] = useState(new Date().toISOString().split('T')[0]);
  const [deriggingDate, setDeriggingDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (templateJob) {
      setName(`${templateJob.name} (Nový Den)`);
      setClient(templateJob.client || '');
      setGaffer(templateJob.assignedGaffer || 'Petr M.');
      setRiggingDate(new Date().toISOString().split('T')[0]);
      setDeriggingDate(new Date().toISOString().split('T')[0]);
    }
  }, [templateJob]);

  if (!templateJob) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    duplicateJobAsTemplate(templateJob.id, {
      name,
      client,
      assignedGaffer: gaffer,
      riggingDate,
      deriggingDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-secondary/60 max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-secondary uppercase flex items-center gap-1">
              <Copy className="w-4 h-4" /> NOVÁ ZAKÁZKA PODLE VZORU
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-0.5">Kopírovat Zakázku</h2>
            <p className="text-xs text-outline">Vzor: <span className="text-on-surface font-semibold">{templateJob.name}</span></p>
          </div>
          <button onClick={() => setTemplateJob(null)} className="text-outline hover:text-on-surface p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-mono text-outline mb-1 uppercase">Název Nové Zakázky *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-outline mb-1 uppercase">Odpovědný Gaffer</label>
            <input
              type="text"
              value={gaffer}
              onChange={(e) => setGaffer(e.target.value)}
              className="w-full h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:outline-none"
            />
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

          <div className="bg-secondary-container/20 border border-secondary/40 p-3 rounded-xl text-xs text-on-secondary-container">
            💡 Do nové zakázky se automaticky zkopíruje kompletní seznam techniky ze vzoru s nulovým počtem naložených kusů (připraveno k nakládce).
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setTemplateJob(null)}
              className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
            >
              Storno
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-secondary text-on-secondary-container font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow"
            >
              <Copy className="w-4 h-4" /> Zkopírovat & Vytvořit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
