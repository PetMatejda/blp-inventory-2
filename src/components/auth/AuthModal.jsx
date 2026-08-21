import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { authService } from '../../services/authService';
import { ShieldCheck, X, LogIn, UserPlus, Shield, User, CheckCircle2, AlertCircle } from 'lucide-react';

export const AuthModal = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser } = useInventory();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('USER');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = authService.loginWithEmail(loginEmail, loginPassword);
    if (result.success) {
      setCurrentUser(result.user);
      setSuccessMsg(`Přihlášen uživatel ${result.user.name} (${result.user.role})`);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    } else {
      setError(result.error);
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = authService.registerWithEmail(regName, regEmail, regPassword, regRole);
    if (result.success) {
      setCurrentUser(result.user);
      setSuccessMsg(`Účet ${result.user.name} úspěšně vytvořen!`);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    } else {
      setError(result.error);
    }
  };

  const handleGoogleLogin = () => {
    setError('');
    const result = authService.loginWithGoogle();
    if (result.success) {
      setCurrentUser(result.user);
      setSuccessMsg(`Přihlášeno přes Google: ${result.user.name}`);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    }
  };

  const handleQuickSwitch = (email, password) => {
    setLoginEmail(email);
    setLoginPassword(password);
    const result = authService.loginWithEmail(email, password);
    if (result.success) {
      setCurrentUser(result.user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-primary/50 max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl relative my-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> UŽIVATELSKÝ PŘÍSTUP & ROLE
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-0.5">Přihlášení / Registrace</h2>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface p-1 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast */}
        {successMsg && (
          <div className="bg-secondary-container text-on-secondary-container p-3 rounded-xl font-bold text-xs flex items-center gap-2 border border-secondary shadow animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-secondary" /> {successMsg}
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="bg-error-container/30 text-error p-3 rounded-xl font-bold text-xs flex items-center gap-2 border border-error/40">
            <AlertCircle className="w-4 h-4 text-error" /> {error}
          </div>
        )}

        {/* Tab Switcher (Přihlášení vs Registrace) */}
        <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'login' ? 'bg-primary text-on-primary-container shadow' : 'text-outline hover:text-on-surface'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Přihlášení
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'register' ? 'bg-primary text-on-primary-container shadow' : 'text-outline hover:text-on-surface'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Registrace Účtu
          </button>
        </div>

        {/* Google Login Fast Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold rounded-xl text-xs border border-outline-variant flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Přihlásit se účtem Google
        </button>

        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-outline-variant w-full"></div>
          <span className="bg-card-bg px-2 text-[10px] font-mono text-outline uppercase shrink-0">Nebo e-mailem</span>
        </div>

        {/* Tab Content: LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">E-mailová adresa:</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="petr@blp.cz"
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Heslo:</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm shadow hover:opacity-95 transition-all mt-1"
            >
              Přihlásit se
            </button>
          </form>
        )}

        {/* Tab Content: REGISTER */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Jméno a Příjmení:</label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Jan Novák (Osvětlovač)"
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">E-mailová adresa:</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="jan@blp.cz"
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Heslo:</label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Úroveň Oprávnění Role:</label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none font-bold"
              >
                <option value="USER">👤 UŽIVATEL (Osvětlovač - Editace v Packaging)</option>
                <option value="ADMIN">👑 ADMIN (Lead Gaffer - Plná Správa & Zakázky)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm shadow hover:opacity-95 transition-all mt-1"
            >
              Vytvořit Účet & Přihlásit
            </button>
          </form>
        )}

        {/* Quick Test Accounts Switcher */}
        <div className="bg-surface-container/60 border border-outline-variant/60 rounded-xl p-3 mt-1">
          <span className="block text-[10px] font-mono font-bold text-outline uppercase mb-2">
            ⚡ Rychlé testování 2 úrovní rolí:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickSwitch('petr@blp.cz', 'admin123')}
              className="flex items-center gap-1.5 p-2 bg-surface-container hover:bg-surface-container-high rounded-lg border border-primary/40 text-left transition-all text-xs"
            >
              <Shield className="w-3.5 h-3.5 text-tertiary shrink-0" />
              <div className="truncate">
                <span className="font-bold block truncate text-on-surface">Petr M.</span>
                <span className="text-[10px] font-mono text-tertiary">ADMIN (Plná práva)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSwitch('jan@blp.cz', 'user123')}
              className="flex items-center gap-1.5 p-2 bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant text-left transition-all text-xs"
            >
              <User className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="truncate">
                <span className="font-bold block truncate text-on-surface">Honza Osv.</span>
                <span className="text-[10px] font-mono text-primary">USER (Pouze Packaging)</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
