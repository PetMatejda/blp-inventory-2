import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Wifi, WifiOff, Settings, Shield, User, LogOut, LogIn, RefreshCw } from 'lucide-react';
import { firebaseAuth } from '../../services/firebaseAuth';

export const TopAppBar = () => {
  const { currentJob, currentUser, setCurrentUser, isAdmin, setIsAuthModalOpen, setIsSettingsModalOpen, isOffline, forceSyncAll, syncStatus } = useInventory();

  const handleLogout = async (e) => {
    e.stopPropagation();
    if (window.confirm('Opravdu se chcete odhlásit ze systému BLP Inventory?')) {
      await firebaseAuth.logout();
      setCurrentUser(null);
      setIsAuthModalOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-outline-variant px-4 h-16 flex items-center justify-between shadow-md backdrop-blur-md bg-opacity-95">
      {/* Left branding & logged in user profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="relative w-9 h-9 rounded-full bg-surface-container-high border border-outline flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity shadow-xs shrink-0"
          title="Otevřít profil uživatele"
        >
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 text-primary" />
          )}
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-primary">BLP INVENTORY</span>
            {currentUser && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-bold flex items-center gap-0.5 ${
                  isAdmin() ? 'bg-tertiary-container text-on-tertiary-container border border-tertiary/40' : 'bg-primary-container text-on-primary-container border border-primary/40'
                }`}
              >
                {isAdmin() ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                {currentUser.role}
              </span>
            )}
          </div>

          {currentUser ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs text-outline flex items-center gap-1 font-medium hover:text-on-surface transition-colors truncate max-w-[140px] sm:max-w-none"
              title="Zobrazit profil / Odhlásit se"
            >
              <span className="font-semibold text-on-surface truncate">{currentUser.name}</span>
              <span className="text-[10px] font-mono text-outline">({currentUser.email})</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs text-primary font-bold hover:underline"
            >
              Přihlásit se do systému
            </button>
          )}
        </div>
      </div>

      {/* Center active job title if available */}
      {currentJob && (
        <div className="hidden md:flex flex-col items-center">
          <span className="text-xs font-mono tracking-wider text-outline uppercase">Aktivní Zakázka</span>
          <span className="text-sm font-bold text-on-surface truncate max-w-xs">{currentJob.name}</span>
        </div>
      )}

      {/* Right controls: Force Sync, Connection, Logout & Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={forceSyncAll}
          className={`p-2 rounded-full border transition-all ${
            syncStatus === 'syncing'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500 animate-spin'
              : 'bg-surface-container hover:bg-surface-container-high text-primary border-outline-variant'
          }`}
          title="Vynutit okamžitou synchronizaci s Firebase cloudem"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors ${
            isOffline
              ? 'bg-error-container text-on-error-container border-error'
              : 'bg-secondary-container/20 text-secondary border-secondary/40'
          }`}
          title="Stav síťového připojení"
        >
          {isOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-error" /> OFFLINE
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-secondary" /> ONLINE
            </>
          )}
        </button>

        {/* Dedicated Logout Button */}
        {currentUser ? (
          <button
            onClick={handleLogout}
            className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors active:scale-95"
            title="Odhlásit se ze systému"
          >
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="p-2 text-primary hover:bg-surface-variant rounded-full transition-colors active:scale-95"
            title="Přihlásit se"
          >
            <LogIn className="w-5 h-5" />
          </button>
        )}

        {/* Settings gear */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-2 text-primary hover:bg-surface-variant rounded-full transition-colors active:scale-95"
          title="Otevřít Systémové Nastavení"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
