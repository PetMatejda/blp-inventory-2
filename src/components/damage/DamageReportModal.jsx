import React, { useEffect, useRef, useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { uploadPhoto, photoPath } from '../../services/photoService';
import { Camera, AlertTriangle, X, Trash2 } from 'lucide-react';

const SEVERITIES = [
  { id: 'LIGHT', label: 'Lehké (Kosmetické)', active: 'bg-surface-variant text-on-surface border-outline shadow' },
  { id: 'MAJOR', label: 'Nefunkční (Major)', active: 'bg-tertiary-container text-on-tertiary-container border-tertiary shadow' },
  { id: 'CRITICAL', label: 'Kritické (Risk)', active: 'bg-error-container text-on-error-container border-error shadow' },
];

export const DamageReportModal = () => {
  const { damageReportItem, setDamageReportItem, reportItemDamage } = useInventory();

  const [severity, setSeverity] = useState('MAJOR'); // LIGHT, MAJOR, CRITICAL
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Fresh form for every reported item
  useEffect(() => {
    setSeverity('MAJOR');
    setNotes('');
    setPhotoFile(null);
    setUploadError('');
    setIsSaving(false);
  }, [damageReportItem?.id]);

  // Local preview of the chosen photo
  useEffect(() => {
    if (!photoFile) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  if (!damageReportItem) return null;

  const close = () => setDamageReportItem(null);

  const handlePhotoChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-taking the same photo
    if (file) {
      setPhotoFile(file);
      setUploadError('');
    }
  };

  const save = (photoUrl) => {
    reportItemDamage(damageReportItem.id, severity, notes.trim(), photoUrl || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile) {
      save(null);
      return;
    }
    setIsSaving(true);
    setUploadError('');
    try {
      const url = await uploadPhoto(
        photoFile,
        photoPath('damage', damageReportItem.jobId, damageReportItem.id),
      );
      save(url);
    } catch (err) {
      setUploadError(err.message || 'Fotku se nepodařilo nahrát.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-error max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-error uppercase tracking-widest flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> HLÁŠENÍ POŠKOZENÍ A ZÁVAD
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-1">{damageReportItem.name}</h2>
            <p className="text-xs text-outline font-mono">SN: {damageReportItem.serialNumber || 'Bez SN'}</p>
          </div>
          <button
            onClick={close}
            aria-label="Zavřít"
            className="text-outline hover:text-on-surface p-2 rounded-full hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Photo — real camera on phones, file picker on desktop */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChosen}
          />
          {previewUrl ? (
            <div className="relative h-48 rounded-xl overflow-hidden border border-outline-variant">
              <img src={previewUrl} alt="Fotka závady" className="w-full h-full object-cover" />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoFile(null)}
                  className="h-11 px-3 bg-black/70 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Odebrat
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 px-4 bg-error text-on-error text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg active:scale-95"
                >
                  <Camera className="w-4 h-4" /> Vyfotit znovu
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-32 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container flex flex-col items-center justify-center gap-2 text-on-surface-variant active:scale-[0.98] transition-transform"
            >
              <Camera className="w-9 h-9 stroke-[1.5]" />
              <span className="text-sm font-semibold">Vyfotit závadu</span>
              <span className="text-xs text-outline">nepovinné</span>
            </button>
          )}

          {/* Severity Selector */}
          <div>
            <label className="block text-xs font-mono text-outline mb-2 uppercase">Závažnost poruchy</label>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(s.id)}
                  className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    severity === s.id ? s.active : 'bg-surface-container text-outline border-outline-variant hover:border-outline'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-mono text-outline mb-1.5 uppercase">Popis závady pro sklad</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Např. prasklá výbojka, stržený závit, ohnutá stojna…"
              rows={3}
              className="w-full p-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-error focus:outline-none placeholder:text-outline"
              required
            ></textarea>
          </div>

          {uploadError && (
            <div className="bg-error-container/20 border border-error/40 rounded-xl p-3 text-sm flex flex-col gap-2">
              <span className="text-error font-semibold">{uploadError}</span>
              <button
                type="button"
                onClick={() => save(null)}
                className="self-start px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-bold text-on-surface"
              >
                Uložit závadu bez fotky
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
            >
              Storno
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-error text-on-error font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-60"
            >
              <AlertTriangle className="w-4 h-4" /> {isSaving ? 'Nahrávám fotku…' : 'Nahlásit poškození'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
