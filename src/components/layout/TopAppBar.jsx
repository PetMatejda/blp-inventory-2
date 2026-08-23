import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Settings, RefreshCw, WifiOff, User, LogOut, ChevronDown } from 'lucide-react';
import { firebaseAuth } from '../../services/firebaseAuth';

export const TopAppBar = () => {
  const {
    jobs,
    currentJobId,
    setCurrentJobId,
    currentJob,
    currentUser,
    setCurrentUser,
    setIsAuthModalOpen,
    setIsSettingsModalOpen,
    isOffline,
    forceSyncAll,
    syncStatus,
  } = useInventory();

  const [avatarError, setAvatarError] = useState(false);

  const handleAvatarClick = () => setIsAuthModalOpen(true);

  const handleLogout = async (e) => {
    e.stopPropagation();
    if (window.confirm('Odhlásit se ze systému BLP Inventory?')) {
      await firebaseAuth.logout();
      setCurrentUser(null);
      setIsAuthModalOpen(true);
    }
  };

  const isSyncing = syncStatus === 'syncing';
  const activeJobs = jobs.filter(j => j.status === 'ACTIVE');

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-md border-b border-outline-variant h-14 flex items-center justify-between px-3 shadow-sm">
      {/* LEFT: Avatar + Job dropdown (or title) */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          onClick={handleAvatarClick}
          className="relative w-9 h-9 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center overflow-hidden shrink-0 active:scale-90 transition-transform"
          title="Profil uživatele"
        >
          {currentUser?.avatar && !avatarError ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <User className="w-4 h-4 text-primary" />
          )}
          {/* Online/offline dot */}
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
              isOffline ? 'bg-error' : 'bg-secondary'
            }`}
          />
        </button>

        {/* Dropdown with ACTIVE jobs only */}
        <div className="min-w-0 flex-1">
          {currentJob ? (
            <div className="relative inline-flex items-center max-w-full">
              <select
                value={currentJob.id}
                onChange={(e) => setCurrentJobId(e.target.value)}
                className={`font-bold text-xs sm:text-sm rounded-lg pl-2 pr-6 py-1 border appearance-none truncate leading-tight focus:outline-none cursor-pointer max-w-[200px] sm:max-w-xs transition-colors ${
                  currentJob.status === 'ARCHIVED'
                    ? 'bg-surface-container-high border-outline-variant text-outline'
                    : 'bg-surface-container border-outline-variant text-on-surface hover:border-primary/50'
                }`}
                title="Aktivní zakázky"
              >
                {/* If viewing an archived job from Dashboard, show read-only option */}
                {currentJob.status === 'ARCHIVED' && (
                  <option value={currentJob.id} className="bg-surface-container text-on-surface font-normal">
                    📁 {currentJob.name} (Archiv — pouze pro čtení)
                  </option>
                )}
                {/* ONLY ACTIVE JOBS ARE LISTED */}
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id} className="bg-surface-container text-on-surface font-semibold">
                    {j.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-1.5 pointer-events-none text-outline" />
            </div>
          ) : (
            <h1 className="font-bold text-sm text-on-surface leading-tight">
              BLP Film
            </h1>
          )}
          {/* Offline warning inline */}
          {isOffline && (
            <p className="text-[10px] text-error font-mono font-bold flex items-center gap-1 mt-0.5">
              <WifiOff className="w-3 h-3" /> Offline — data nemusí být aktuální
            </p>
          )}
        </div>
      </div>


      {/* RIGHT: Sync + Settings + Logout — compact */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Sync button */}
        <button
          onClick={forceSyncAll}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${
            isSyncing
              ? 'bg-amber-500/15 border-amber-500/60 text-amber-400'
              : isOffline
              ? 'bg-error-container/20 border-error/40 text-error'
              : 'bg-surface-container border-outline-variant text-outline hover:text-primary hover:border-primary/40'
          }`}
          title={isSyncing ? 'Synchronizuji...' : isOffline ? 'Offline' : 'Synchronizovat'}
        >
          {isOffline ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container text-outline hover:text-primary hover:border-primary/40 transition-all active:scale-90"
          title="Nastavení"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Logout */}
        {currentUser && (
          <button
            onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-transparent text-outline hover:text-error hover:bg-error-container/20 hover:border-error/30 transition-all active:scale-90"
            title="Odhlásit se"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
