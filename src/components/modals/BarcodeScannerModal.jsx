import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { QrCode, X, Check, Camera, Zap, SwitchCamera, AlertCircle, Volume2 } from 'lucide-react';

export const BarcodeScannerModal = () => {
  const { isScannerModalOpen, setIsScannerModalOpen, jobItems, updateItemQuantity } = useInventory();

  const [scannedResult, setScannedResult] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'
  const [cameraError, setCameraError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize Web Camera Stream
  useEffect(() => {
    if (!isScannerModalOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isScannerModalOpen, cameraFacing]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraActive(true);
        }
      } else {
        setCameraError('Kamera není na tomto zařízení nebo prohlížeči podporována.');
      }
    } catch (err) {
      console.warn('Camera access warning:', err);
      setCameraError('Nepodařilo se přistoupit ke kameře (povolte přístup v nastavení prohlížeče). Můžete použít rychlou simulaci skenu.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // AudioContext fallback
    }
  };

  const handleSuccessfulScan = (item) => {
    if (!item) return;
    playSuccessSound();
    updateItemQuantity(item.id, 1);
    setScannedResult(`Naskenováno: ${item.name} (${item.serialNumber || 'Bez SN'}) - Přičten +1 ks`);
    setTimeout(() => setScannedResult(null), 3000);
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isScannerModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-primary/50 max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-secondary uppercase flex items-center gap-1">
              <QrCode className="w-4 h-4" /> REÁLNÝ KÓDOVÝ SKENER TECHNIKY
            </span>
            <h2 className="text-xl font-bold text-on-surface">Skenování QR / Barcode Kamerou</h2>
          </div>
          <button
            onClick={() => {
              stopCamera();
              setIsScannerModalOpen(false);
            }}
            className="text-outline hover:text-on-surface p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Success Toast */}
        {scannedResult && (
          <div className="bg-secondary-container text-on-secondary-container p-3.5 rounded-xl font-bold text-xs flex items-center justify-between border border-secondary shadow-lg animate-bounce">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-secondary" /> {scannedResult}
            </span>
            <Volume2 className="w-4 h-4 text-secondary" />
          </div>
        )}

        {/* Live Video Camera Viewfinder */}
        <div className="relative h-64 bg-black rounded-2xl overflow-hidden border-2 border-outline-variant flex items-center justify-center group shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
          />

          {!isCameraActive && (
            <div className="flex flex-col items-center gap-2 text-outline p-6 text-center z-10">
              <Camera className="w-12 h-12 text-outline/40 animate-pulse" />
              <span className="text-xs font-mono text-outline">{cameraError || 'Aktivace kamery...'}</span>
            </div>
          )}

          {/* Laser scanning beam line animation */}
          <div className="absolute inset-x-4 h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse z-20 top-1/2 -translate-y-1/2"></div>

          {/* Viewfinder frame corners */}
          <div className="absolute inset-8 border-2 border-dashed border-secondary/80 pointer-events-none rounded-xl z-20 flex items-center justify-center">
            <span className="text-[10px] font-mono text-secondary bg-black/70 backdrop-blur px-2.5 py-1 rounded font-bold border border-secondary/40">
              ZAMĚŘTE ČÁROVÝ / QR KÓD POŘÍZENÉHO KUSU
            </span>
          </div>

          {/* Camera Flip Control button */}
          <button
            onClick={toggleCameraFacing}
            className="absolute bottom-3 right-3 z-30 p-2.5 bg-black/70 backdrop-blur text-white rounded-xl border border-white/20 hover:bg-black/90 transition-all active:scale-95"
            title="Přepnout přední / zadní kameru"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        </div>

        {/* Manual Quick-Scan selector for testing */}
        <div>
          <label className="block text-xs font-mono text-outline mb-2 uppercase">
            Testovací Simulace Skenu (Rychlé Přičtení):
          </label>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {jobItems.length === 0 ? (
              <div className="text-xs text-outline italic text-center py-2">
                Žádné položky v této zakázce.
              </div>
            ) : (
              jobItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSuccessfulScan(item)}
                  className="flex justify-between items-center bg-surface-container hover:bg-surface-container-high p-2.5 rounded-xl border border-outline-variant text-left transition-all active:scale-98"
                >
                  <div>
                    <span className="block text-sm font-semibold text-on-surface">{item.name}</span>
                    <span className="text-[11px] font-mono text-outline">SN: {item.serialNumber || 'N/A'}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary bg-primary-container/20 px-2 py-1 rounded border border-primary/30 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-secondary" /> Skenovat (+1)
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setIsScannerModalOpen(false);
          }}
          className="w-full py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
        >
          Zavřít Skener
        </button>
      </div>
    </div>
  );
};
