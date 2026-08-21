import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { firebaseAuth } from '../../services/firebaseAuth';
import { ShieldCheck, X, LogIn, UserPlus, Shield, User, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, isForceAuth = false }) => {
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
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await firebaseAuth.loginWithEmail(loginEmail, loginPassword);
    setLoading(false);
    if (result.success) {
      setCurrentUser(result.user);
      setSuccessMsg(`Přihlášen uživatel ${result.user.name} (${result.user.role})`);
      setTimeout(() => {
        setSuccessMsg('');
        if (onClose) onClose();
      }, 800);
    } else {
      setError(result.error);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await firebaseAuth.registerWithEmail(regName, regEmail, regPassword, regRole);
    setLoading(false);
    if (result.success) {
      setCurrentUser(result.user);
      setSuccessMsg(`Účet ${result.user.name} úspěšně vytvořen ve Firebase!`);
      setTimeout(() => {
        setSuccessMsg('');
        if (onClose) onClose();
      }, 800);
    } else {
      setError(result.error);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const result = await firebaseAuth.loginWithGoogle();
    setLoading(false);
    if (result.success) {
      setCurrentUser(result.user);
      setSuccessMsg(`Přihlášeno přes Google: ${result.user.name}`);
      setTimeout(() => {
        setSuccessMsg('');
        if (onClose) onClose();
      }, 800);
    } else {
      setError(result.error || 'Nepodařilo se přihlásit přes Google.');
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await firebaseAuth.logout();
    setCurrentUser(null);
    setLoading(false);
    setActiveTab('login');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-primary/50 max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl relative my-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> AUTHENTIKACE ŠTÁBU
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-0.5">
              {currentUser ? 'Profil Uživatele' : 'Přihlášení do Systému'}
            </h2>
          </div>

          {/* Close button allowed only if already authenticated and not forced */}
          {!isForceAuth && currentUser && onClose && (
            <button onClick={onClose} className="text-outline hover:text-on-surface p-1 rounded-full">
              <X className="w-5 h-5" />
            </button>
          )}
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

        {/* LOGGED IN USER PROFILE SCREEN */}
        {currentUser ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-3 bg-surface-container p-4 rounded-xl border border-outline-variant">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-primary shrink-0 shadow-md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-on-surface truncate">{currentUser.name}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold ${
                      currentUser.role === 'ADMIN' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <p className="text-xs text-outline truncate">{currentUser.email}</p>
                <span className="text-[10px] font-mono text-secondary mt-1 block">
                  Přihlášeno přes {currentUser.provider === 'google' ? 'Google OAuth' : 'E-mail'}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleLogout}
              className="w-full py-3 bg-error-container/30 border border-error/40 hover:bg-error-container/50 text-error font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Odhlásit se ze Systému
            </button>
          </div>
        ) : (
          /* NOT LOGGED IN - LOGIN / REGISTER FORM */
          <>
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

            {/* Google Login Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold rounded-xl text-xs border border-outline-variant flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 disabled:opacity-50"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {loading ? 'Ověřuji v Google OAuth...' : 'Přihlásit se Google Účtem'}
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
                    placeholder="vas.email@gmail.com"
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
                  disabled={loading}
                  className="w-full py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm shadow hover:opacity-95 transition-all mt-1 disabled:opacity-50"
                >
                  {loading ? 'Přihlašování v cloudu...' : 'Přihlásit se'}
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
                    placeholder="jan.novak@gmail.com"
                    className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-sm text-on-surface focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Heslo (min. 6 znaků):</label>
                  <input
                    type="password"
                    required
                    minLength={6}
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
                  disabled={loading}
                  className="w-full py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm shadow hover:opacity-95 transition-all mt-1 disabled:opacity-50"
                >
                  {loading ? 'Registruji...' : 'Vytvořit Účet'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
