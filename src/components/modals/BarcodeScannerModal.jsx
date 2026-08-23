import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  QrCode, X, Check, Camera, Zap, SwitchCamera,
  AlertCircle, Volume2, Plus, Search, CheckCircle2, RefreshCw
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export const BarcodeScannerModal = () => {
  const {
    isScannerModalOpen,
    setIsScannerModalOpen,
    jobItems,
    catalog,
    currentJob,
    updateItemQuantity,
    updateItemStatus,
    addCatalogItemToJob
  } = useInventory();

  const [scannedResult, setScannedResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [catalogMatch, setCatalogMatch] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'

  const scannerRef = useRef(null);
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');

  const isModeDerigging = currentJob?.mode === 'DERIGGING';

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

    // 1. Search in current job items
    const match = jobItems.find(i => {
      if (i.barcode && i.barcode.toLowerCase() === code.toLowerCase()) return true;
      if (i.serialNumber && i.serialNumber.toLowerCase().includes(code.toLowerCase())) return true;
      if (i.id && i.id.toLowerCase() === code.toLowerCase()) return true;
      if (i.name && i.name.toLowerCase() === code.toLowerCase()) return true;
      return false;
    });

    if (match) {
      playSuccessSound();
      setCatalogMatch(null);

      if (isModeDerigging) {
        // Derigging flow: mark item packed / increment
        updateItemQuantity(match.id, 1);
        if (match.status !== 'PACKED' && match.quantityLoaded <= match.quantityRequested) {
          updateItemStatus(match.id, 'PACKED');
        }
        setScannedResult({
          type: 'success',
          text: `Derigging: ${match.name}`,
          detail: `SN: ${match.serialNumber || 'Bez SN'} • Zaevidováno k odvozu (+1 ks)`
        });
      } else {
        // Rigging flow: increment loaded quantity
        updateItemQuantity(match.id, 1);
        setScannedResult({
          type: 'success',
          text: `Rigging: ${match.name}`,
          detail: `SN: ${match.serialNumber || 'Bez SN'} • Naloženo (+1 ks)`
        });
      }

      setTimeout(() => setScannedResult(null), 4000);
      return;
    }

    // 2. Search in master catalog
    const catMatch = (catalog || []).find(c => {
      if (c.barcode && c.barcode.toLowerCase() === code.toLowerCase()) return true;
      if (c.serialPrefix && c.serialPrefix.toLowerCase() === code.toLowerCase()) return true;
      if (c.id && c.id.toLowerCase() === code.toLowerCase()) return true;
      if (c.name && c.name.toLowerCase() === code.toLowerCase()) return true;
      return false;
    });

    if (catMatch) {
      playSuccessSound();
      setCatalogMatch(catMatch);
      setScannedResult({
        type: 'catalog',
        text: `Nalezeno v katalogu: ${catMatch.name}`,
        detail: `Kód: ${code} • Není zatím na této zakázce. Chcete přidat?`
      });
      return;
    }

    // 3. Not found
    playNotFoundSound();
    setCatalogMatch(null);
    setScannedResult({
      type: 'error',
      text: `Kód nenalezen: ${code}`,
      detail: `Položka s tímto čárovým kódem nebo SN není na zakázce ani v katalogu.`
    });
    setTimeout(() => setScannedResult(null), 4500);
  };

  const handleAddCatalogMatchToJob = () => {
    if (!catalogMatch) return;
    addCatalogItemToJob(catalogMatch);
    playSuccessSound();
    const name = catalogMatch.name;
    setCatalogMatch(null);
    setScannedResult({
      type: 'success',
      text: `Přidáno do zakázky: ${name}`,
      detail: `Položka byla úspěšně přidána a zaevidována.`
    });
    setTimeout(() => setScannedResult(null), 3000);
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

  if (!isScannerModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-3xl border border-primary/40 max-w-lg w-full p-5 sm:p-6 flex flex-col gap-4 shadow-2xl relative my-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center border border-primary/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-primary uppercase">
                {isModeDerigging ? 'Derigging Skener' : 'Rigging Skener'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-on-surface">Čtečka Čárových & QR Kódů</h2>
            </div>
          </div>
          <button
            onClick={() => {
              cleanupScanner();
              setIsScannerModalOpen(false);
            }}
            className="text-outline hover:text-on-surface p-2 rounded-full hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Feedback Banner */}
        {scannedResult && (
          <div className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col gap-1 border shadow-lg animate-in fade-in zoom-in-95 duration-200 ${
            scannedResult.type === 'success'
              ? 'bg-secondary-container text-on-secondary-container border-secondary'
              : scannedResult.type === 'catalog'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-error-container/30 text-error border-error/50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold">
                {scannedResult.type === 'success' && <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />}
                {scannedResult.type === 'catalog' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                {scannedResult.type === 'error' && <AlertCircle className="w-4 h-4 text-error shrink-0" />}
                {scannedResult.text}
              </span>
              <Volume2 className="w-4 h-4 opacity-70 shrink-0" />
            </div>
            <p className="text-[11px] font-normal opacity-90 pl-6">{scannedResult.detail}</p>
            
            {/* Action button if found in catalog */}
            {catalogMatch && (
              <button
                type="button"
                onClick={handleAddCatalogMatchToJob}
                className="mt-2 ml-6 py-2 px-3 bg-amber-500 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" /> Přidat položku do této zakázky (+1 ks)
              </button>
            )}
          </div>
        )}

        {/* Live Camera Viewfinder Box */}
        <div className="relative bg-black rounded-2xl overflow-hidden border border-outline-variant min-h-[240px] flex items-center justify-center shadow-inner">
          <div id="blp-html5-qr-reader" className="w-full h-full" />

          {cameraError && (
            <div className="absolute inset-0 bg-card-bg/95 flex flex-col items-center justify-center p-6 text-center gap-3">
              <Camera className="w-10 h-10 text-outline/50" />
              <p className="text-xs text-outline">{cameraError}</p>
            </div>
          )}

          {/* Camera Flip Button */}
          <button
            onClick={toggleCamera}
            type="button"
            className="absolute bottom-3 right-3 z-30 p-2.5 bg-black/70 backdrop-blur text-white rounded-xl border border-white/20 hover:bg-black/90 active:scale-95 transition-all"
            title="Přepnout přední / zadní kameru"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        </div>

        {/* Manual Barcode Entry / Laser Gun Input */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Zadat kód ručně nebo čtečkou..."
              className="w-full h-11 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2.5 bg-primary text-on-primary-container font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-95 disabled:opacity-40 shadow shrink-0"
          >
            <Zap className="w-4 h-4" /> Zpracovat
          </button>
        </form>

        {/* Quick Simulation items list for test without physical barcodes */}
        <div className="border-t border-outline-variant/60 pt-3">
          <label className="block text-[11px] font-mono text-outline mb-1.5 uppercase">
            Položky na zakázce (klikněte pro rychlé nasimulování skenu):
          </label>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {jobItems.length === 0 ? (
              <div className="text-xs text-outline italic text-center py-2">
                Žádné položky na této zakázce.
              </div>
            ) : (
              jobItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => processCode(item.barcode || item.serialNumber || item.name)}
                  className="flex justify-between items-center bg-surface-container hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant text-left transition-all active:scale-98"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block text-xs font-semibold text-on-surface truncate">{item.name}</span>
                    <span className="text-[10px] font-mono text-outline">
                      {item.barcode ? `BARCODE: ${item.barcode} | ` : ''}SN: {item.serialNumber || 'Bez SN'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-primary bg-primary-container/20 px-2 py-1 rounded border border-primary/30 flex items-center gap-1 shrink-0">
                    <Zap className="w-3 h-3 text-secondary" /> +1
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            cleanupScanner();
            setIsScannerModalOpen(false);
          }}
          className="w-full py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm active:scale-98"
        >
          Zavřít Skener
        </button>
      </div>
    </div>
  );
};
