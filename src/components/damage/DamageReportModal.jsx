import React, { useEffect, useRef, useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { savePhoto } from '../../services/photoService';
import { Camera, AlertTriangle, Trash2 } from 'lucide-react';
import { Sheet } from '../common/Dialogs';
import { Field, inputCls, SheetButtons } from '../common/FormField';

const SEVERITIES = [
  { id: 'LIGHT', label: 'Lehká', hint: 'kosmetická', active: 'bg-surface-variant text-on-surface border-outline shadow' },
  { id: 'MAJOR', label: 'Nefunkční', hint: 'nejde použít', active: 'bg-tertiary-container text-on-tertiary-container border-tertiary shadow' },
  { id: 'CRITICAL', label: 'Kritická', hint: 'nebezpečná', active: 'bg-error-container text-on-error-container border-error shadow' },
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
      const ref = await savePhoto(photoFile, {
        kind: 'damage', jobId: damageReportItem.jobId, itemId: damageReportItem.id,
      });
      save(ref);
    } catch (err) {
      setUploadError(err.message || 'Fotku se nepodařilo uložit.');
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={damageReportItem.name}
      subtitle={`Hlášení závady${damageReportItem.serialNumber ? ` · SN ${damageReportItem.serialNumber}` : ''}`}
      onClose={close}
      dismissOnBackdrop={false}
      footer={<SheetButtons onCancel={close} form="damage-form" submitLabel={isSaving ? 'Ukládám fotku…' : 'Nahlásit závadu'} icon={AlertTriangle} tone="danger" disabled={isSaving} />}
    >
      <form id="damage-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Photo — real camera on phones, file picker on desktop */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChosen} />
        {previewUrl ? (
          <div className="relative h-48 rounded-xl overflow-hidden border border-outline-variant shrink-0">
            <img src={previewUrl} alt="Fotka závady" className="w-full h-full object-cover" />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button type="button" onClick={() => setPhotoFile(null)} className="h-11 px-3 bg-black/70 text-white text-sm font-bold rounded-xl flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Odebrat
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="h-11 px-4 bg-black/70 text-white text-sm font-bold rounded-xl flex items-center gap-2 active:scale-95">
                <Camera className="w-4 h-4" /> Znovu
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-28 shrink-0 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container flex flex-col items-center justify-center gap-1.5 text-on-surface-variant active:scale-[0.98] transition-transform"
          >
            <Camera className="w-9 h-9 stroke-[1.5]" />
            <span className="text-base font-semibold">Vyfotit závadu</span>
            <span className="text-sm text-outline">nepovinné</span>
          </button>
        )}

        <div>
          <span className="block text-sm font-semibold text-on-surface-variant mb-1.5">Závažnost</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Závažnost">
            {SEVERITIES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={severity === s.id}
                onClick={() => setSeverity(s.id)}
                className={`min-h-[56px] px-2 py-1.5 rounded-xl text-sm font-bold border text-center leading-tight ${
                  severity === s.id ? s.active : 'bg-surface-container text-on-surface-variant border-outline-variant'
                }`}
              >
                {s.label}
                <span className="block text-xs font-normal opacity-80">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Popis závady pro sklad" required>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Např. prasklá výbojka, stržený závit, ohnutá stojna…"
            rows={3}
            required
            autoCapitalize="sentences"
            className={`${inputCls} h-auto py-3`}
          />
        </Field>

        {uploadError && (
          <div className="bg-error-container/20 border border-error/40 rounded-xl p-3 text-sm flex flex-col gap-2">
            <span className="text-error font-semibold">{uploadError}</span>
            <button type="button" onClick={() => save(null)} className="self-start h-11 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-bold text-on-surface">
              Uložit závadu bez fotky
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
};
