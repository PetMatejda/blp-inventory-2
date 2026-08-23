import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Settings, X, Moon, Sun, CloudUpload, CheckCircle2, AlertCircle, Smartphone, Download, ShieldCheck } from 'lucide-react';
import { storageService } from '../../services/storageService';

export const SettingsModal = () => {
  const { isSettingsModalOpen, setIsSettingsModalOpen, themeMode, setThemeMode } = useInventory();
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (!isSettingsModalOpen) return null;

  const handleManualCloudPush = async () => {
    setLoading(true);
    setSyncStatus(null);
    const res = await storageService.syncToCloudManual();
    setLoading(false);
    if (res.success) {
      setSyncStatus({ type: 'success', text: 'Data byla úspěšně nahrána do Firebase!' });
    } else {
      setSyncStatus({ type: 'error', text: `Chyba zápisu: ${res.error || 'Zkontrolujte přihlášení'}` });
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('Pro instalaci aplikace na Androidu:\n1. Otevřete web v prohlížeči Chrome na mobilu\n2. Klikněte na menu 3 teček (⋮) vpravo nahoře\n3. Zvolte "Přidat na domovskou obrazovku" nebo "Nainstalovat aplikaci"');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <Settings className="w-4 h-4" /> NASTAVENÍ
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-1">Nastavení Aplikace</h2>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Status Toast */}
        {syncStatus && (
          <div
            className={`p-3 rounded-xl font-bold text-xs flex items-center gap-2 border ${
              syncStatus.type === 'success'
                ? 'bg-secondary-container text-on-secondary-container border-secondary shadow'
                : 'bg-error-container/30 text-error border-error/40'
            }`}
          >
            {syncStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{syncStatus.text}</span>
          </div>
        )}

        {/* Android App & PWA Installation */}
        <div className="bg-surface-container p-4 rounded-xl border border-secondary/40 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="BLP Film App Icon"
              className="w-12 h-12 rounded-xl object-cover border-2 border-secondary shadow-md shrink-0"
            />
            <div>
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-secondary" /> Mobilní aplikace
              </h3>
              <p className="text-xs text-outline">Nativní PWA prostředí bez lišty prohlížeče</p>
            </div>
          </div>

          <button
            onClick={handleInstallApp}
            className="w-full py-2.5 px-4 bg-secondary text-on-secondary-container font-mono font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow hover:opacity-90"
          >
            <Download className="w-4 h-4" />
            {isInstalled ? 'Aplikace je nainstalována' : '📲 Nainstalovat na mobil'}
          </button>
        </div>

        {/* Cloud Sync */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono text-outline uppercase font-bold">Cloud synchronizace</label>
          <button
            onClick={handleManualCloudPush}
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-on-primary-container font-mono font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md hover:opacity-95 disabled:opacity-50"
          >
            <CloudUpload className="w-4 h-4" />
            {loading ? 'Nahrávám...' : '🔥 Vynutit nahrání dat do Firebase'}
          </button>
        </div>

        {/* Theme */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono text-outline uppercase font-bold">Vzhled</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setThemeMode('light')}
              className={`py-3 px-3 rounded-xl border text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                themeMode === 'light'
                  ? 'bg-primary-container text-on-primary-container border-primary shadow'
                  : 'bg-surface-container text-outline border-outline-variant hover:border-outline'
              }`}
            >
              <Sun className="w-4 h-4 text-tertiary" /> Light
            </button>
            <button
              onClick={() => setThemeMode('dark')}
              className={`py-3 px-3 rounded-xl border text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                themeMode === 'dark'
                  ? 'bg-primary-container text-on-primary-container border-primary shadow'
                  : 'bg-surface-container text-outline border-outline-variant hover:border-outline'
              }`}
            >
              <Moon className="w-4 h-4 text-primary" /> Dark
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-surface-container p-3 rounded-xl border border-outline-variant text-xs font-mono text-outline flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-secondary" /> BLP INVENTORY
          </span>
          <span className="font-bold text-on-surface">v2.0.0</span>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(false)}
          className="w-full py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
        >
          Zavřít
        </button>
      </div>
    </div>
  );
};
