// One full-screen camera scanner for the whole app (packing, stock, catalog,
// stocktake, new labelled units). The caller decides what a code means:
//
//   <ScannerScreen title="Skener" subtitle="Sklad" onClose={close}
//     onCode={(code) => ({ type: 'success', text: 'Naloženo: ARRI M18' })} />
//
// onCode may return a result shown in the large panel at the bottom:
//   { type: 'success' | 'error' | 'ask', text, detail?, close?,
//     actions?: [{ label, icon?, onClick, keepOpen? }] }
// `close: true` closes the scanner right after the scan (e.g. "found, show it").
// Returning nothing shows a neutral "Načteno: <code>".
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, SwitchCamera, Flashlight, FlashlightOff, AlertCircle, CheckCircle2, Keyboard, ScanLine } from 'lucide-react';
import { useBackLayer } from '../../hooks/useBackLayer';
// html5-qrcode (~370 kB) is loaded only when the scanner opens.

const READER_ID = 'blp-scanner-reader';
const REPEAT_MS = 2000; // the same code is ignored for 2 s

/**
 * iPhones have no built-in barcode detector, so html5-qrcode falls back to its
 * ZXing decoder — with "try harder" switched off. In that mode a 1D barcode is
 * read only when its bars stand upright in the picture; the Comsys labels are
 * stuck rotated by 90°, so they were never found. The library has no option
 * for it: the decoder keeps its hints in a Map where "try harder" is the only
 * `false` entry, and we flip it. If the library changes, this does nothing.
 */
const enableThoroughDecoding = (scanner) => {
  try {
    for (const decoder of [scanner.qrcode?.primaryDecoder, scanner.qrcode?.secondaryDecoder]) {
      if (!(decoder?.hints instanceof Map)) continue;
      for (const [hint, value] of decoder.hints) if (value === false) decoder.hints.set(hint, true);
    }
  } catch (e) {
    // keep the library defaults
  }
};

const beep = (frequency, type, seconds, volume) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
    osc.onended = () => ctx.close().catch(() => {});
  } catch (e) {
    // AudioContext unavailable
  }
};

const RESULT_STYLE = {
  success: 'bg-emerald-600 text-white',
  ask: 'bg-amber-400 text-black',
  error: 'bg-red-600 text-white',
};
const iconBtn = 'w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90';

export const ScannerScreen = ({ title = 'Skener', subtitle = '', hint = 'Namiřte kameru na štítek nebo čárový kód.', onCode, onClose, children }) => {
  const [result, setResult] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [recent, setRecent] = useState([]); // older results, newest first
  const [cameraError, setCameraError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [facing, setFacing] = useState('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef(null);
  const lastRef = useRef({ code: '', at: 0 });
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode; // keep the camera running when the parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useBackLayer(true, onClose);

  const handleCode = (rawCode) => {
    const code = (rawCode || '').trim();
    if (!code) return;
    const now = Date.now();
    if (code === lastRef.current.code && now - lastRef.current.at < REPEAT_MS) return;
    lastRef.current = { code, at: now };

    const r = onCodeRef.current?.(code) || { type: 'success', text: `Načteno: ${code}` };
    if (r.type === 'error') {
      beep(330, 'triangle', 0.25, 0.2);
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    } else {
      beep(1046.5, 'sine', 0.15, 0.3);
      if (navigator.vibrate) navigator.vibrate(60);
    }
    if (r.close) { onCloseRef.current?.(); return; }
    setResult((prev) => {
      if (prev) setRecent((list) => [{ ok: prev.type !== 'error', text: prev.text, id: now }, ...list].slice(0, 3));
      return r;
    });
    setScanCount((n) => n + 1);
  };
  const handleCodeRef = useRef(handleCode);
  handleCodeRef.current = handleCode;

  // Camera
  useEffect(() => {
    let cancelled = false;
    let scanner = null;
    setCameraError('');
    setIsScanning(false);
    setTorchSupported(false);
    setTorchOn(false);

    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
        if (cancelled) return;
        // Only the kinds of codes found on equipment: our QR labels, the old
        // Comsys barcode labels and EAN codes on boxes. Fewer formats = faster frames.
        scanner = new Html5Qrcode(READER_ID, {
          verbose: false,
          formatsToSupport: [F.QR_CODE, F.DATA_MATRIX, F.CODE_128, F.CODE_39, F.CODE_93, F.CODABAR, F.ITF, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
        });
        enableThoroughDecoding(scanner);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: facing },
          {
            fps: 10,
            qrbox: (w, h) => {
              const edge = Math.min(w, h);
              return { width: Math.floor(edge * 0.8), height: Math.floor(edge * 0.55) };
            },
          },
          (text) => { if (!cancelled) handleCodeRef.current(text); },
          () => {}, // frames without a code
        );
        if (cancelled) return;
        setIsScanning(true);
        // Torch (flashlight) — only some phones / cameras expose it.
        try {
          setTorchSupported(scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported());
        } catch (e) {
          setTorchSupported(false);
        }
      } catch (err) {
        console.warn('[ScannerScreen]', err);
        if (!cancelled) setCameraError('Kamera není dostupná nebo byl zamítnut přístup. Kód můžete zadat ručně níže nebo použít čtečku.');
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      scannerRef.current = null;
      if (scanner) {
        try {
          if (scanner.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {});
          else scanner.clear();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [facing]);

  const toggleTorch = async () => {
    try {
      await scannerRef.current.getRunningTrackCameraCapabilities().torchFeature().apply(!torchOn);
      setTorchOn(!torchOn);
    } catch (e) {
      setTorchSupported(false);
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    lastRef.current = { code: '', at: 0 }; // typing the same code again is intentional
    handleCode(manualCode);
    setManualCode('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[65] bg-black flex flex-col animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Zavřít skener" className={iconBtn}>
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0 text-white">
          <p className="text-base font-bold leading-tight truncate">{title}</p>
          {subtitle && <p className="text-sm text-white/70 truncate">{subtitle}</p>}
        </div>
        {torchSupported && (
          <button onClick={toggleTorch} aria-label={torchOn ? 'Vypnout svítilnu' : 'Zapnout svítilnu'} aria-pressed={torchOn}
            className={torchOn ? 'w-12 h-12 rounded-full bg-amber-400 text-black flex items-center justify-center active:scale-90' : iconBtn}>
            {torchOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
          </button>
        )}
        <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Přepnout přední / zadní kameru" className={iconBtn}>
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
        <div id={READER_ID} className="w-full" />
        {cameraError && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 text-center gap-3 text-white">
            <Camera className="w-12 h-12 text-white/50" />
            <p className="text-base">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Result + manual entry, within thumb reach */}
      <div className="shrink-0 bg-card-bg rounded-t-3xl border-t border-outline-variant px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-3 max-h-[55dvh] overflow-y-auto">
        <div aria-live="assertive">
          {result ? (
            <div key={scanCount} className={`rounded-2xl p-4 flex flex-col gap-2 animate-fade-in ${RESULT_STYLE[result.type] || RESULT_STYLE.success}`}>
              <div className="flex items-start gap-3">
                {result.type === 'success' ? <CheckCircle2 className="w-7 h-7 shrink-0" /> : <AlertCircle className="w-7 h-7 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-snug break-words">{result.text}</p>
                  {result.detail && <p className="text-sm opacity-90 break-words">{result.detail}</p>}
                </div>
              </div>
              {result.actions?.map((a, i) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => {
                      const next = a.onClick?.();
                      if (a.keepOpen) { setResult(next || null); setScanCount((n) => n + 1); } else onClose?.();
                    }}
                    className={`h-14 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] ${i === 0 ? 'bg-black text-white' : 'bg-black/15 text-black border border-black/30'}`}
                  >
                    {Icon && <Icon className="w-5 h-5" />} {a.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-base text-on-surface-variant text-center py-3 flex items-center justify-center gap-2">
              <ScanLine className="w-5 h-5 shrink-0" /> {cameraError ? 'Zadejte kód ručně.' : isScanning ? hint : 'Spouštím kameru…'}
            </p>
          )}
        </div>

        {recent.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Předchozí skeny">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm text-on-surface-variant">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" /> : <AlertCircle className="w-4 h-4 text-error shrink-0" />}
                <span className="truncate">{r.text}</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submitManual} className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Zadat kód ručně"
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="go"
              aria-label="Kód ručně"
              className="w-full h-12 pl-10 pr-3 bg-surface-container border border-outline-variant rounded-xl text-base text-on-surface focus:outline-none focus:border-primary font-mono"
            />
          </div>
          <button type="submit" disabled={!manualCode.trim()} className="h-12 px-4 bg-primary text-on-primary font-bold text-base rounded-xl active:scale-95 disabled:opacity-40 shrink-0">
            OK
          </button>
        </form>

        {children}
      </div>
    </div>,
    document.body,
  );
};
