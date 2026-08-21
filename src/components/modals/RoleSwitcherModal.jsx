import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { UserCheck, X, Shield, User, LogIn } from 'lucide-react';
import { authService } from '../../services/authService';

export const RoleSwitcherModal = () => {
  const { isRoleModalOpen, setIsRoleModalOpen, currentUser, setCurrentUser, setIsAuthModalOpen } = useInventory();

  if (!isRoleModalOpen) return null;

  const users = authService.getUsers();

  const handleSelectUser = (user) => {
    setCurrentUser(user);
    setIsRoleModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <UserCheck className="w-4 h-4" /> UŽIVATELSKÝ ÚČET & ROLE
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-1">Aktivní Uživatel</h2>
          </div>
          <button onClick={() => setIsRoleModalOpen(false)} className="text-outline hover:text-on-surface p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 my-1">
          {users.map((u) => {
            const isSelected = currentUser?.id === u.id;
            const isAdminRole = u.role === 'ADMIN';

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectUser(u)}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary-container/20 ring-1 ring-primary/40'
                    : 'bg-surface-container border-outline-variant hover:border-outline'
                }`}
              >
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="w-10 h-10 rounded-full object-cover border border-outline shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-on-surface truncate">{u.name}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-bold ${
                        isAdminRole ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-outline truncate">{u.email}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIsRoleModalOpen(false);
              setIsAuthModalOpen(true);
            }}
            className="flex-1 py-3 bg-primary text-on-primary-container font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <LogIn className="w-4 h-4" /> Přihlásit Jiný Účet / Registrace
          </button>
          <button
            type="button"
            onClick={() => setIsRoleModalOpen(false)}
            className="px-4 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-xs"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
