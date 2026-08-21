import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Wifi, WifiOff, Settings, UserCheck } from 'lucide-react';

export const TopAppBar = () => {
  const { currentJob, userRole, setIsRoleModalOpen, setIsSettingsModalOpen, isOffline } = useInventory();

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-outline-variant px-4 h-16 flex items-center justify-between shadow-md backdrop-blur-md bg-opacity-95">
      {/* Left branding & profile badge (opens Role Switcher) */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsRoleModalOpen(true)}
          className="relative w-9 h-9 rounded-full bg-surface-container-high border border-outline flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
          title="Přepnout uživatelskou roli (Role Switcher)"
        >
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
            alt="Technician avatar"
            className="w-full h-full object-cover"
          />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-primary">BLP INVENTORY</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-mono uppercase">v2.0</span>
          </div>
          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="text-xs text-outline flex items-center gap-1 font-medium hover:text-on-surface transition-colors"
            title="Přepnout uživatelskou roli"
          >
            <UserCheck className="w-3 h-3 text-secondary" /> {userRole}
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

      {/* Right controls: Offline badge & Dedicated Settings button */}
      <div className="flex items-center gap-2">
        {/* Connection simulator badge */}
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

        {/* Dedicated Settings gear button */}
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
