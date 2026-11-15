import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Check, RefreshCw, WifiOff, User, ChevronDown, Lock, Bell } from 'lucide-react';
import { alertCounts } from '../../domain/alerts';

// One clear sync state the crew can trust (ANALYZA_A_NAVRH.md, 3.8).
const SYNC_CHIP = {
  synced: { icon: Check, label: 'Uloženo', cls: 'bg-secondary-container/60 text-on-secondary-container border-secondary/40' },
  syncing: { icon: RefreshCw, label: 'Ukládám…', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50', spin: true },
  offline: { icon: WifiOff, label: 'Offline', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/60' },
  error: { icon: Lock, label: 'Bez přístupu', cls: 'bg-error-container/40 text-error border-error/50' },
};

export const TopAppBar = () => {
  const { jobs, setCurrentJobId, currentJob, currentUser, setIsSettingsModalOpen, forceSyncAll, syncStatus, alerts, activeTab, setActiveTab } = useInventory();
  const counts = alertCounts(alerts);
  const [avatarError, setAvatarError] = useState(false);

  const activeJobs = jobs.filter((j) => j.status === 'ACTIVE');
  const chip = SYNC_CHIP[syncStatus] || SYNC_CHIP.synced;
  const ChipIcon = chip.icon;

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-md border-b border-outline-variant h-14 flex items-center justify-between gap-2 px-3 shadow-sm">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-11 h-11 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center overflow-hidden shrink-0 active:scale-90"
          aria-label="Profil a nastavení"
        >
          {currentUser?.avatar && !avatarError
            ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
            : <User className="w-5 h-5 text-primary" />}
        </button>

        {currentJob ? (
          <div className="relative min-w-0 flex-1">
            <select
              value={currentJob.id}
              onChange={(e) => setCurrentJobId(e.target.value)}
              aria-label="Aktuální zakázka"
              className="w-full h-11 font-bold text-base rounded-xl pl-3 pr-8 border appearance-none truncate bg-surface-container border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            >
              {currentJob.status === 'ARCHIVED' && <option value={currentJob.id}>📁 {currentJob.name} (archiv)</option>}
              {activeJobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
          </div>
        ) : (
          <h1 className="font-bold text-base text-on-surface">BLP Inventory</h1>
        )}
      </div>

      <button
        onClick={() => setActiveTab('alerts')}
        className={`relative w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 active:scale-95 ${activeTab === 'alerts' ? 'bg-primary-container border-primary text-on-primary-container' : 'bg-surface-container border-outline-variant text-on-surface'}`}
        aria-label={counts.urgent ? `Upozornění: ${counts.urgent}` : 'Upozornění'}
      >
        <Bell className="w-5 h-5" />
        {counts.urgent > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-background ${counts.critical ? 'bg-error text-on-error' : 'bg-amber-500 text-black'}`}>
            {counts.urgent > 99 ? '99+' : counts.urgent}
          </span>
        )}
      </button>

      <button
        onClick={forceSyncAll}
        className={`h-11 px-3 rounded-xl border text-sm font-semibold flex items-center gap-1.5 shrink-0 active:scale-95 ${chip.cls}`}
        aria-label={`Stav ukládání: ${chip.label}. Klepnutím ověříte odeslání do cloudu.`}
      >
        <ChipIcon className={`w-4 h-4 ${chip.spin ? 'animate-spin' : ''}`} />
        <span className="hidden min-[380px]:inline">{chip.label}</span>
      </button>
    </header>
  );
};
