import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ShieldCheck, X, Lock, Check, KeyRound } from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, onSuccess, title = 'Ověření PIN Kódem Gaffa' }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDigit = (d) => {
    if (pin.length < 4) {
      setPin(prev => prev + d);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Default Lead Gaffer PIN is 1234
    if (pin === '1234' || pin === '0000') {
      onSuccess();
      setPin('');
      setError('');
      onClose();
    } else {
      setError('Neplatný PIN kód. Zadejte výchozí PIN 1234.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card-bg rounded-2xl border border-primary/50 max-w-sm w-full p-6 flex flex-col gap-4 shadow-2xl relative">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> BEZPEČNOSTNÍ OVĚŘENÍ
            </span>
            <h2 className="text-lg font-bold text-on-surface mt-0.5">{title}</h2>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-outline">
          Pro provedení této oprávněné akce zadejte PIN kód vedoucího osvětlovače (Lead Gaffer PIN: <strong>1234</strong>).
        </p>

        {/* PIN Display Dots */}
        <div className="flex justify-center gap-3 my-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                pin.length > idx
                  ? 'border-primary bg-primary-container/30 text-primary shadow'
                  : 'border-outline-variant bg-surface-container text-outline'
              }`}
            >
              {pin.length > idx ? '●' : ''}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-center text-xs font-bold text-error bg-error-container/30 p-2 rounded-lg border border-error/40">
            {error}
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num.toString())}
              className="h-12 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold font-mono text-lg rounded-xl border border-outline-variant active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 bg-surface-container hover:bg-surface-container-high text-error font-bold text-xs rounded-xl border border-outline-variant active:scale-95 transition-all"
          >
            Smazat
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold font-mono text-lg rounded-xl border border-outline-variant active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pin.length < 4}
            className="h-12 bg-primary text-on-primary-container font-bold text-xs rounded-xl border border-primary flex items-center justify-center gap-1 disabled:opacity-40 active:scale-95 transition-all shadow"
          >
            <Check className="w-4 h-4" /> Vstoupit
          </button>
        </div>
      </div>
    </div>
  );
};
