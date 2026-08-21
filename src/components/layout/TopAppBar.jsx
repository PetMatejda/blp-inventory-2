import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Settings, RefreshCw, Wifi, WifiOff, Shield, User, LogOut } from 'lucide-react';
import { firebaseAuth } from '../../services/firebaseAuth';

export const TopAppBar = () => {
  const {
    currentJob,
    currentUser,
    setCurrentUser,
    isAdmin,
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

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-md border-b border-outline-variant h-14 flex items-center justify-between px-3 shadow-sm">
      {/* LEFT: Avatar + App name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={handleAvatarClick}
          className="relative w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center overflow-hidden shrink-0 active:scale-90 transition-transform"
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
          {/* Online/offline dot on avatar */}
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
              isOffline ? 'bg-error' : 'bg-secondary'
            }`}
          />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold tracking-widest text-primary leading-none">BLP</span>
            <span className="font-mono text-[11px] font-bold text-on-surface-variant tracking-wide leading-none">INVENTORY</span>
          </div>
          {/* Active job name — truncated, below app name */}
          {currentJob ? (
            <p className="text-xs font-semibold text-on-surface truncate max-w-[140px] sm:max-w-[220px] leading-tight mt-0.5">
              {currentJob.name}
            </p>
          ) : currentUser ? (
            <p className="text-[11px] text-outline leading-tight mt-0.5 truncate max-w-[140px]">
              {currentUser.name}
            </p>
          ) : null}
        </div>
      </div>

      {/* RIGHT: Sync + Settings — only 2 clean actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Sync button — spins while syncing */}
        <button
          onClick={forceSyncAll}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${
            isSyncing
              ? 'bg-amber-500/15 border-amber-500/60 text-amber-400'
              : isOffline
              ? 'bg-error-container/20 border-error/40 text-error'
              : 'bg-surface-container border-outline-variant text-outline hover:text-primary hover:border-primary/40'
          }`}
          title={isSyncing ? 'Synchronizuji...' : isOffline ? 'Offline — bez připojení' : 'Synchronizovat s cloudem'}
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

        {/* Logout — only if logged in, clear red icon */}
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
