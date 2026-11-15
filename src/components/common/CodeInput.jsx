// Code entry for stocktakes and labelled units:
//  - text field that works with Bluetooth / USB barcode readers (they type + Enter)
//  - optional camera scanning (continuous; the same code is ignored for 2 s)
import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine } from 'lucide-react';

let scannerSeq = 0;

export const CameraScanner = ({ onCode, active }) => {
  const idRef = useRef(`code-scanner-${++scannerSeq}`);
  const lastRef = useRef({ code: '', at: 0 });
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode; // keep the camera running when the parent re-renders
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return undefined;
    let scanner = null;
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;
        scanner = new Html5Qrcode(idRef.current);
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.8), height: Math.floor(Math.min(w, h) * 0.5) }) },
          (text) => {
            const now = Date.now();
            if (text === lastRef.current.code && now - lastRef.current.at < 2000) return;
            lastRef.current = { code: text, at: now };
            if (navigator.vibrate) navigator.vibrate(60);
            onCodeRef.current(text);
          },
          () => {},
        );
      } catch (err) {
        console.warn('[CameraScanner]', err);
        setError('Kamera není dostupná. Použijte čtečku nebo zadejte kód ručně.');
      }
    })();
    return () => {
      stopped = true;
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [active]);

  if (!active) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-outline-variant bg-black">
      <div id={idRef.current} className="w-full" />
      {error && <p className="text-sm text-amber-300 p-3">{error}</p>}
    </div>
  );
};

/** Text field + camera toggle. Calls onCode(code) for every scanned/entered code. */
export const CodeInput = ({ onCode, placeholder = 'Naskenujte nebo zadejte kód', autoFocus = true }) => {
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
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            className="w-full h-12 pl-10 pr-3 bg-card-bg border border-outline-variant rounded-xl text-base text-on-surface focus:border-primary focus:outline-none font-mono"
          />
        </div>
        <button type="button" onClick={() => setCamera((c) => !c)} aria-label={camera ? 'Vypnout kameru' : 'Skenovat kamerou'}
          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${camera ? 'bg-primary text-on-primary border-primary' : 'bg-card-bg border-outline-variant text-secondary'}`}>
          {camera ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>
      </form>
      <CameraScanner active={camera} onCode={onCode} />
    </div>
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
