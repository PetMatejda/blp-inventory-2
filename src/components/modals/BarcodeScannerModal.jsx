import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  X, Camera, Zap, SwitchCamera, Flashlight, FlashlightOff,
  AlertCircle, Plus, CheckCircle2, Keyboard,
} from 'lucide-react';
import { useBackLayer } from '../../hooks/useBackLayer';
// html5-qrcode (~370 kB) is loaded only when the camera scanner opens.
import { phaseOf } from '../../domain/labels';

export const BarcodeScannerModal = () => {
  const {
    isScannerModalOpen,
    setIsScannerModalOpen,
    jobItems,
    currentJob,
    addCatalogItemToJob,
    stock,
  } = useInventory();

  const [scannedResult, setScannedResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [catalogMatch, setCatalogMatch] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [recent, setRecent] = useState([]); // last scans, newest first
  const [scanCount, setScanCount] = useState(0);

  const scannerRef = useRef(null);
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');

  // Phase decides what a scan means (see stockActions.scanOnJob).

  // Play auditory feedback beep on successful scan
  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // AudioContext unavailable
    }
  };

  const playNotFoundSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // ignore
    }
  };

  const remember = (ok, text) => {
    setScanCount((n) => n + 1);
    setRecent((list) => [{ ok, text, id: Date.now() }, ...list].slice(0, 4));
  };

  // Core processing logic when a code is decoded (from camera or manual entry)
  const processCode = (rawCode) => {
    if (!rawCode || !rawCode.trim()) return;
    const code = rawCode.trim();

    // Debounce duplicate scans within 2 seconds for the same code
    const now = Date.now();
    if (code === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 2000) {
      return;
    }
    lastScannedTimeRef.current = now;
    lastScannedCodeRef.current = code;

    // Labelled units, catalog labels (BLP:…), EAN and serial numbers; meaning depends on the phase.
    const r = stock.scanOnJob(currentJob?.id, code);
    if (r.ok) {
      playSuccessSound();
      if (navigator.vibrate) navigator.vibrate(60);
      setCatalogMatch(null);
      setScannedResult({ type: 'success', text: r.message, detail: r.warning || code });
      remember(true, r.message);
      return;
    }

    if (r.needsAdd) {
      playSuccessSound();
      setCatalogMatch(r.needsAdd);
      setScannedResult({ type: 'catalog', text: r.message, detail: `Kód ${code} — položka zatím není v zakázce` });
      setScanCount((n) => n + 1);
      return;
    }

    playNotFoundSound();
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    setCatalogMatch(null);
    setScannedResult({ type: 'error', text: r.message, detail: code });
    remember(false, r.message);
  };

  const handleAddCatalogMatchToJob = () => {
    if (!catalogMatch) return;
    addCatalogItemToJob(catalogMatch);
    playSuccessSound();
    const name = catalogMatch.name;
    setCatalogMatch(null);
    setScannedResult({ type: 'success', text: `Přidáno do zakázky: ${name}`, detail: '' });
    remember(true, `Přidáno: ${name}`);
  };

  // Start Html5Qrcode camera scanner
  useEffect(() => {
    if (!isScannerModalOpen) {
      cleanupScanner();
      return;
    }

    let isMounted = true;
    const scannerId = "blp-html5-qr-reader";

    const initScanner = async () => {
      try {
        setCameraError(null);
        setIsScanning(true);

        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;
        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.75),
              height: Math.floor(minEdge * 0.55),
            };
          },
          aspectRatio: 1.333333,
        };

        await html5QrCode.start(
          { facingMode: cameraFacing },
          config,
          (decodedText) => {
            if (isMounted) {
              processCode(decodedText);
            }
          },
          () => {
            // Frame parse noise, ignore
          }
        );
        // Torch (flashlight) — only some phones / cameras expose it.
        try {
          const torch = html5QrCode.getRunningTrackCameraCapabilities().torchFeature();
          if (isMounted) { setTorchSupported(torch.isSupported()); setTorchOn(false); }
        } catch (e) {
          if (isMounted) setTorchSupported(false);
        }
      } catch (err) {
        console.warn('Html5Qrcode start error:', err);
        if (isMounted) {
          setCameraError('Kamera není dostupná nebo byl zamítnut přístup. Můžete zadat kód ručně níže nebo použít Bluetooth čtečku.');
          setIsScanning(false);
        }
      }
    };

    // Small delay to ensure DOM element is mounted
    const timer = setTimeout(() => {
      initScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isScannerModalOpen, cameraFacing]);

  const cleanupScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          }).catch(() => {});
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      } catch (e) {
        // ignore cleanup error
      }
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processCode(manualCode);
    setManualCode('');
  };

  const toggleCamera = () => {
    cleanupScanner();
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleTorch = async () => {
    try {
      const torch = scannerRef.current.getRunningTrackCameraCapabilities().torchFeature();
      await torch.apply(!torchOn);
      setTorchOn(!torchOn);
    } catch (e) {
      setTorchSupported(false);
    }
  };

  const close = () => {
    cleanupScanner();
    setScannedResult(null);
    setCatalogMatch(null);
    setRecent([]);
    setIsScannerModalOpen(false);
  };
  useBackLayer(isScannerModalOpen, close);

  if (!isScannerModalOpen) return null;

  const RESULT_STYLE = {
    success: 'bg-emerald-600 text-white',
    catalog: 'bg-amber-400 text-black',
    error: 'bg-red-600 text-white',
  };
  const iconBtn = 'w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in" role="dialog" aria-modal="true" aria-label="Skener kódů">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button onClick={close} aria-label="Zavřít skener" className={iconBtn}>
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0 text-white">
          <p className="text-base font-bold leading-tight truncate">Skener · {phaseOf(currentJob?.mode).name}</p>
          <p className="text-sm text-white/70 truncate">{currentJob?.name}</p>
        </div>
        {torchSupported && (
          <button onClick={toggleTorch} aria-label={torchOn ? 'Vypnout svítilnu' : 'Zapnout svítilnu'} aria-pressed={torchOn}
            className={torchOn ? 'w-12 h-12 rounded-full bg-amber-400 text-black flex items-center justify-center active:scale-90' : iconBtn}>
            {torchOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
          </button>
        )}
        <button onClick={toggleCamera} aria-label="Přepnout přední / zadní kameru" className={iconBtn}>
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
        <div id="blp-html5-qr-reader" className="w-full" />
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
          {scannedResult ? (
            <div key={scanCount} className={`rounded-2xl p-4 flex flex-col gap-2 animate-fade-in ${RESULT_STYLE[scannedResult.type]}`}>
              <div className="flex items-start gap-3">
                {scannedResult.type === 'success' ? <CheckCircle2 className="w-7 h-7 shrink-0" /> : <AlertCircle className="w-7 h-7 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-snug break-words">{scannedResult.text}</p>
                  {scannedResult.detail && <p className="text-sm opacity-90 break-words">{scannedResult.detail}</p>}
                </div>
              </div>
              {catalogMatch && (
                <button type="button" onClick={handleAddCatalogMatchToJob} className="h-14 rounded-xl bg-black text-white text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98]">
                  <Plus className="w-5 h-5" /> Přidat do zakázky (+1 ks)
                </button>
              )}
            </div>
          ) : (
            <p className="text-base text-on-surface-variant text-center py-3">
              {isScanning ? 'Namiřte kameru na štítek nebo čárový kód.' : 'Spouštím kameru…'}
            </p>
          )}
        </div>

        {recent.length > 1 && (
          <ul className="flex flex-col gap-1" aria-label="Poslední skeny">
            {recent.slice(1).map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm text-on-surface-variant">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" /> : <AlertCircle className="w-4 h-4 text-error shrink-0" />}
                <span className="truncate">{r.text}</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleManualSubmit} className="flex gap-2">
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

        {/* Quick simulation list for testing without physical barcodes — dev builds only */}
        {import.meta.env.DEV && (
          <details className="text-sm">
            <summary className="text-on-surface-variant py-1">Simulace skenu (jen vývoj)</summary>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto mt-1">
              {jobItems.map((item) => (
                <button key={item.id} type="button" onClick={() => processCode(item.barcode || item.serialNumber || item.name)}
                  className="flex justify-between items-center gap-2 bg-surface-container px-3 py-2 rounded-xl border border-outline-variant text-left">
                  <span className="truncate text-on-surface">{item.name}</span>
                  <Zap className="w-4 h-4 text-secondary shrink-0" />
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};
