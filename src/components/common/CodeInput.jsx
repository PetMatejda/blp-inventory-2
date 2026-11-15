// Code entry for stocktakes and labelled units:
//  - text field that works with Bluetooth / USB barcode readers (they type + Enter)
//  - camera button that opens the shared full-screen scanner (ScannerScreen)
import React, { useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { ScannerScreen } from './ScannerScreen';

/**
 * Text field + camera button. Calls onCode(code) for every scanned/entered code.
 * onCode may return a ScannerScreen result ({ type, text, detail }) to show it in the scanner.
 */
export const CodeInput = ({ onCode, placeholder = 'Naskenujte nebo zadejte kód', autoFocus = true, scannerTitle = 'Skener' }) => {
  const [value, setValue] = useState('');
  const [camera, setCamera] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const code = value.trim();
    if (!code) return;
    onCode(code);
    setValue('');
  };

  return (
    <>
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            enterKeyHint="go"
            className="w-full h-12 pl-10 pr-3 bg-card-bg border border-outline-variant rounded-xl text-base text-on-surface focus:border-primary focus:outline-none font-mono"
          />
        </div>
        <button type="button" onClick={() => setCamera(true)} aria-label="Skenovat kamerou"
          className="w-12 h-12 rounded-xl border bg-card-bg border-outline-variant text-secondary flex items-center justify-center shrink-0 active:scale-90">
          <Camera className="w-6 h-6" />
        </button>
      </form>
      {camera && <ScannerScreen title={scannerTitle} onCode={(code) => onCode(code, true)} onClose={() => setCamera(false)} />}
    </>
  );
};

/** Saves text as a file in the browser (used for CSV exports). */
export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
