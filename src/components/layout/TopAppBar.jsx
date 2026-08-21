import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Wifi, WifiOff, Settings, Shield, User, LogIn } from 'lucide-react';

export const TopAppBar = () => {
  const { currentJob, currentUser, isAdmin, setIsAuthModalOpen, setIsSettingsModalOpen, isOffline } = useInventory();

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-outline-variant px-4 h-16 flex items-center justify-between shadow-md backdrop-blur-md bg-opacity-95">
      {/* Left branding & logged in user profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="relative w-9 h-9 rounded-full bg-surface-container-high border border-outline flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity shadow-xs"
          title="Uživatelský účet & Přihlášení"
        >
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'}
            alt={currentUser?.name || 'User Avatar'}
            className="w-full h-full object-cover"
          />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-primary">BLP INVENTORY</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-bold flex items-center gap-0.5 ${
                isAdmin() ? 'bg-tertiary-container text-on-tertiary-container border border-tertiary/40' : 'bg-primary-container text-on-primary-container border border-primary/40'
              }`}
            >
              {isAdmin() ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
              {currentUser?.role || 'USER'}
            </span>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="text-xs text-outline flex items-center gap-1 font-medium hover:text-on-surface transition-colors truncate max-w-[140px] sm:max-w-none"
            title="Přihlášený uživatel (Klikněte pro profil / odhlášení)"
          >
            <span className="font-semibold text-on-surface truncate">{currentUser?.name || 'Přihlásit se'}</span>
            <span className="text-[10px] font-mono text-outline">({currentUser?.email})</span>
          </button>
        </div>
      </div>

      {/* Center active job title if available */}
      {currentJob && (
        <div className="hidden md:flex flex-col items-center">
          <span className="text-xs font-mono tracking-wider text-outline uppercase">Aktivní Zakázka</span>
          <span className="text-sm font-bold text-on-surface truncate max-w-xs">{currentJob.name}</span>
        </div>
      )}

      {/* Right controls: Connection & Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors ${
            isOffline
              ? 'bg-error-container text-on-error-container border-error'
              : 'bg-secondary-container/20 text-secondary border-secondary/40'
          }`}
          title="Stav síťového připojení (Nastavení)"
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

        {/* Auth modal trigger */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="p-2 text-primary hover:bg-surface-variant rounded-full transition-colors active:scale-95"
          title="Účet & Přihlášení"
        >
          <LogIn className="w-5 h-5" />
        </button>

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
