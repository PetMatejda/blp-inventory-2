import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Settings, X, Moon, Sun, CloudUpload, CheckCircle2, AlertCircle, Smartphone, Download, ShieldCheck, LogOut, User } from 'lucide-react';
import { useDialogs } from '../common/Dialogs';
import { firebaseAuth } from '../../services/firebaseAuth';

export const SettingsModal = () => {
  const {
    isSettingsModalOpen, setIsSettingsModalOpen, themeMode, setThemeMode,
    forceSyncAll, hasPendingWrites, isOffline, currentUser, setCurrentUser, setIsAuthModalOpen,
    migrationInfo, catalog, jobs, stockLevels,
  } = useInventory();
  const { confirm } = useDialogs();
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
    await forceSyncAll();
    setLoading(false);
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
      await confirm({
        title: 'Instalace na telefon',
        message: '1. Otevřete web v Chrome na mobilu\n2. Klepněte na menu ⋮ vpravo nahoře\n3. Zvolte „Přidat na plochu“ nebo „Nainstalovat aplikaci“',
        confirmLabel: 'Rozumím',
        cancelLabel: 'Zavřít',
      });
    }
  };

  /** Deletes the offline copy of the data in this browser and reloads from the cloud. */
  const resetLocalCache = async () => {
    const warn = hasPendingWrites ? '\n\n⚠️ Některé změny se ještě neodeslaly do cloudu a vymazáním se ztratí. Nejdřív počkejte na „Uloženo“.' : '';
    if (await confirm({
      title: 'Vymazat offline data?',
      message: `Smaže se jen kopie dat v tomto prohlížeči; v cloudu zůstane vše. Pomáhá, když aplikace zamrzá nebo padá.${warn}`,
      confirmLabel: 'Vymazat a načíst znovu',
      danger: true,
    })) {
      window.location.href = `${window.location.pathname}?reset-cache=1`;
    }
  };

  const handleLogout = async () => {
    const warn = hasPendingWrites ? '\n\nNěkteré změny se ještě neodeslaly do cloudu — po odhlášení se odešlou až při dalším přihlášení na tomto zařízení.' : '';
    if (await confirm({ title: 'Odhlásit se?', message: `Účet ${currentUser?.email || ''}${warn}`, confirmLabel: 'Odhlásit', danger: !!warn })) {
      await firebaseAuth.logout();
      setCurrentUser(null);
      setIsSettingsModalOpen(false);
      setIsAuthModalOpen(true);
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

        {/* Profile */}
        {currentUser && (
          <div className="flex items-center gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant">
            <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
              {currentUser.avatar ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base text-on-surface truncate">{currentUser.name}</p>
              <p className="text-sm text-on-surface-variant truncate">{currentUser.email}</p>
            </div>
            <button onClick={handleLogout} className="h-11 px-3 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface flex items-center gap-1.5 shrink-0">
              <LogOut className="w-4 h-4" /> Odhlásit
            </button>
          </div>
        )}

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
          <p className="text-xs text-on-surface-variant">
            {isOffline
              ? '📴 Offline – změny se ukládají v telefonu a odešlou se po připojení.'
              : hasPendingWrites
                ? '⏳ Některé změny se ještě odesílají do cloudu.'
                : '✅ Všechny změny jsou uložené v cloudu.'}
          </p>
          <button
            onClick={handleManualCloudPush}
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-on-primary-container font-mono font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md hover:opacity-95 disabled:opacity-50"
          >
            <CloudUpload className="w-4 h-4" />
            {loading ? 'Odesílám…' : 'Odeslat a ověřit uložení v cloudu'}
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

        {/* Data diagnostics */}
        <details className="bg-surface-container p-3 rounded-xl border border-outline-variant text-sm">
          <summary className="font-semibold text-on-surface cursor-pointer">Stav dat</summary>
          <ul className="mt-2 text-on-surface-variant flex flex-col gap-0.5">
            <li>Zakázky: {jobs.length} · Katalog: {catalog.length} · Položky skladu: {stockLevels.length}</li>
            <li>Převod dat: {migrationInfo ? (migrationInfo.status === 'done' ? 'dokončen' : migrationInfo.status) : 'neproběhl'}{migrationInfo?.finishedAt ? ` ${new Date(migrationInfo.finishedAt).toLocaleString('cs-CZ')}` : ''}{migrationInfo?.by ? ` · ${migrationInfo.by}` : ''}</li>
            {migrationInfo?.counts && <li>Převedeno: {Object.entries(migrationInfo.counts).map(([k, v]) => `${k} ${v}`).join(', ')}</li>}
          </ul>
          <button onClick={resetLocalCache} className="mt-2 h-11 px-3 rounded-xl border border-error/40 bg-card-bg text-error font-semibold">Vymazat offline data v tomto zařízení</button>
        </details>

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
