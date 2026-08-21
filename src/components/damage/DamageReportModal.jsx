import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Camera, AlertTriangle, X, Upload, Check } from 'lucide-react';

export const DamageReportModal = () => {
  const { damageReportItem, setDamageReportItem, reportItemDamage } = useInventory();

  const [severity, setSeverity] = useState('MAJOR'); // LIGHT, MAJOR, CRITICAL
  const [notes, setNotes] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!damageReportItem) return null;

  const handleCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      // Simulate snapshot capture with film set equipment image
      const photos = [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
      ];
      setCapturedPhoto(photos[Math.floor(Math.random() * photos.length)]);
      setIsCapturing(false);
    }, 600);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    reportItemDamage(
      damageReportItem.id,
      severity,
      notes || 'Závada nahlášena z mobilní aplikace.',
      capturedPhoto || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80'
    );
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
            onClick={() => setDamageReportItem(null)}
            className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Camera Viewfinder Simulator */}
          <div className="relative h-48 bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant flex items-center justify-center group">
            {/* Viewfinder crosshair overlay */}
            <div className="absolute inset-4 border border-white/20 pointer-events-none rounded flex flex-col justify-between p-2">
              <div className="flex justify-between text-[10px] font-mono text-white/50">
                <span>[CAM-01]</span>
                <span>REC ●</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-white/50">
                <span>4K RAW</span>
                <span>ISO 800</span>
              </div>
            </div>

            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Damaged preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-outline">
                <Camera className="w-10 h-10 stroke-[1.5]" />
                <span className="text-xs font-mono">Fotoaparát připraven</span>
              </div>
            )}

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={isCapturing}
              className="absolute bottom-3 right-3 h-11 px-4 bg-error text-on-error font-mono text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg hover:bg-opacity-90 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" /> {isCapturing ? 'Pořizování...' : capturedPhoto ? 'Vyfotit Znova' : 'Pořídit Foto'}
            </button>
          </div>

          {/* Severity Selector */}
          <div>
            <label className="block text-xs font-mono text-outline mb-2 uppercase">Závažnost Poruchy</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSeverity('LIGHT')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  severity === 'LIGHT'
                    ? 'bg-surface-variant text-on-surface border-outline shadow'
                    : 'bg-surface-container text-outline border-outline-variant hover:border-outline'
                }`}
              >
                Lehké (Kosmetické)
              </button>

              <button
                type="button"
                onClick={() => setSeverity('MAJOR')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  severity === 'MAJOR'
                    ? 'bg-tertiary-container text-on-tertiary-container border-tertiary shadow'
                    : 'bg-surface-container text-outline border-outline-variant hover:border-outline'
                }`}
              >
                Nefunkční (Major)
              </button>

              <button
                type="button"
                onClick={() => setSeverity('CRITICAL')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  severity === 'CRITICAL'
                    ? 'bg-error-container text-on-error-container border-error shadow'
                    : 'bg-surface-container text-outline border-outline-variant hover:border-outline'
                }`}
              >
                Kritické (Risk)
              </button>
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-mono text-outline mb-1.5 uppercase">Popis Závady pro Sklad</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Uveďte podrobnosti o závadě (např. prasklá výbojka, stržený závit, ohnutá stojna)..."
              rows={3}
              className="w-full p-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:border-error focus:outline-none placeholder:text-outline"
              required
            ></textarea>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setDamageReportItem(null)}
              className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
            >
              Storno
            </button>

            <button
              type="submit"
              className="flex-1 py-3 bg-error text-on-error font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <AlertTriangle className="w-4 h-4" /> Nahlásit Poškození
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
