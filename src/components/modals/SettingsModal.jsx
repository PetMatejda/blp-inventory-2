import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Moon, Sun, CloudUpload, Download, ShieldCheck, LogOut, User, History, ChevronRight } from 'lucide-react';
import { useDialogs, Sheet } from '../common/Dialogs';
import { firebaseAuth } from '../../services/firebaseAuth';
import { McpAccessSection } from '../settings/McpAccessSection';

export const SettingsModal = () => {
  const {
    isSettingsModalOpen, setIsSettingsModalOpen, themeMode, setThemeMode,
    forceSyncAll, hasPendingWrites, isOffline, currentUser, setCurrentUser, setIsAuthModalOpen,
    migrationInfo, catalog, jobs, stockLevels, setActiveTab,
  } = useInventory();
  const { confirm } = useDialogs();
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

  const close = () => setIsSettingsModalOpen(false);

  const handleManualCloudPush = async () => {
    setLoading(true);
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
      // Leave the page only after the dialogs have released their history entries (Back button support).
      setTimeout(() => { window.location.replace(`${window.location.pathname}?reset-cache=1`); }, 400);
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

  const themeBtn = (id, label, Icon) => (
    <button
      onClick={() => setThemeMode(id)}
      role="radio"
      aria-checked={themeMode === id}
      className={`h-12 rounded-xl border text-base font-semibold flex items-center justify-center gap-2 ${
        themeMode === id
          ? 'bg-primary-container text-on-primary-container border-primary shadow'
          : 'bg-surface-container text-on-surface-variant border-outline-variant'
      }`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  return (
    <Sheet title="Nastavení" onClose={close}>
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

      {/* Theme */}
      <div>
        <span className="block text-sm font-semibold text-on-surface-variant mb-1.5">Vzhled</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Vzhled">
          {themeBtn('light', 'Světlý', Sun)}
          {themeBtn('dark', 'Tmavý', Moon)}
        </div>
      </div>

      {/* Cloud sync */}
      <div>
        <span className="block text-sm font-semibold text-on-surface-variant mb-1.5">Ukládání do cloudu</span>
        <p className="text-sm text-on-surface mb-2">
          {isOffline
            ? 'Offline – změny se ukládají v telefonu a odešlou se po připojení.'
            : hasPendingWrites
              ? 'Některé změny se ještě odesílají do cloudu.'
              : 'Všechny změny jsou uložené v cloudu.'}
        </p>
        <button
          onClick={handleManualCloudPush}
          disabled={loading}
          className="w-full h-12 px-4 border border-outline-variant bg-surface-container text-on-surface font-semibold rounded-xl text-base flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
        >
          <CloudUpload className="w-5 h-5 text-primary" />
          {loading ? 'Odesílám…' : 'Odeslat a ověřit uložení'}
        </button>
      </div>

      {/* Change history (moved here from the bottom bar) */}
      <button
        onClick={() => { close(); setActiveTab('history'); }}
        className="w-full min-h-[56px] px-4 py-2 bg-surface-container border border-outline-variant rounded-xl flex items-center gap-3 text-left active:scale-[0.98]"
      >
        <History className="w-5 h-5 text-primary shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-base font-semibold text-on-surface">Historie změn</span>
          <span className="block text-sm text-on-surface-variant">Kdo, kdy a co v aplikaci změnil</span>
        </span>
        <ChevronRight className="w-5 h-5 text-outline shrink-0" />
      </button>

      {/* Install as an app */}
      {!isInstalled && (
        <button
          onClick={handleInstallApp}
          className="w-full min-h-[56px] px-4 py-2 bg-surface-container border border-secondary/40 rounded-xl flex items-center gap-3 text-left active:scale-[0.98]"
        >
          <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-base font-semibold text-on-surface">Nainstalovat na telefon</span>
            <span className="block text-sm text-on-surface-variant">Ikona na ploše, bez lišty prohlížeče</span>
          </span>
          <Download className="w-5 h-5 text-secondary shrink-0" />
        </button>
      )}

      {/* AI access (MCP tokens) */}
      <McpAccessSection />

      {/* Data diagnostics */}
      <details className="bg-surface-container p-3 rounded-xl border border-outline-variant text-sm">
        <summary className="font-semibold text-on-surface cursor-pointer py-1">Stav dat</summary>
        <ul className="mt-2 text-on-surface-variant flex flex-col gap-0.5">
          <li>Zakázky: {jobs.length} · Katalog: {catalog.length} · Položky skladu: {stockLevels.length}</li>
          <li>Převod dat: {migrationInfo ? (migrationInfo.status === 'done' ? 'dokončen' : migrationInfo.status) : 'neproběhl'}{migrationInfo?.finishedAt ? ` ${new Date(migrationInfo.finishedAt).toLocaleString('cs-CZ')}` : ''}{migrationInfo?.by ? ` · ${migrationInfo.by}` : ''}</li>
          {migrationInfo?.counts && <li>Převedeno: {Object.entries(migrationInfo.counts).map(([k, v]) => `${k} ${v}`).join(', ')}</li>}
        </ul>
        <button onClick={resetLocalCache} className="mt-2 min-h-[44px] px-3 py-2 rounded-xl border border-error/40 bg-card-bg text-error font-semibold text-left">Vymazat offline data v tomto zařízení</button>
      </details>

      <p className="text-sm text-on-surface-variant flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-secondary" /> BLP Inventory v2.0.0
      </p>
    </Sheet>
  );
};
