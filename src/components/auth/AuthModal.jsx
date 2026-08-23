import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { firebaseAuth } from '../../services/firebaseAuth';
import {
  checkWebAuthnSupport,
  hasRegisteredCredential,
  registerBiometric,
  authenticateWithBiometric,
  removeBiometricCredential,
} from '../../services/webAuthnService';
import {
  ShieldCheck, X, LogIn, UserPlus, Shield, CheckCircle2,
  AlertCircle, LogOut, Fingerprint, ScanFace, Trash2, Mail, ChevronDown, ChevronUp
} from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, isForceAuth = false }) => {
  const { currentUser, setCurrentUser } = useInventory();
  const [activeTab, setActiveTab] = useState('login');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('USER');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // WebAuthn
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [showBioRegister, setShowBioRegister] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    checkWebAuthnSupport().then(({ platformAuth }) => {
      setWebAuthnSupported(platformAuth);
      setHasCredential(hasRegisteredCredential());
    });
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Login success ──
  const onLoginSuccess = (user, via = '') => {
    setCurrentUser(user);
    const msg = via ? `Přihlášeno přes ${via}: ${user.name}` : `Přihlášen: ${user.name}`;
    setSuccessMsg(msg);
    if (webAuthnSupported && !hasRegisteredCredential()) {
      setShowBioRegister(true);
    } else {
      setTimeout(() => {
        setSuccessMsg('');
        if (onClose) onClose();
      }, 800);
    }
  };

  // ── Biometric ──
  const handleBiometricLogin = async () => {
    setBioLoading(true);
    setError('');
    const result = await authenticateWithBiometric();
    setBioLoading(false);
    if (result.success) {
      onLoginSuccess(result.user, 'biometrie');
    } else {
      setError(result.error);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!currentUser) return;
    setBioLoading(true);
    const result = await registerBiometric(currentUser);
    setBioLoading(false);
    if (result.success) {
      setHasCredential(true);
      setShowBioRegister(false);
      setSuccessMsg('Biometrie aktivována! Příště se přihlásíte otiskem prstu.');
      setTimeout(() => {
        setSuccessMsg('');
        if (onClose) onClose();
      }, 1800);
    } else {
      setError(result.error);
    }
  };

  const handleRemoveBiometric = () => {
    removeBiometricCredential();
    setHasCredential(false);
    setSuccessMsg('Biometrie odregistrována.');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // ── Email Login ──
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await firebaseAuth.loginWithEmail(loginEmail, loginPassword);
    setLoading(false);
    if (result.success) {
      onLoginSuccess(result.user, 'e-mail');
    } else {
      setError(result.error);
    }
  };

  // ── Email Register ──
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await firebaseAuth.registerWithEmail(regName, regEmail, regPassword, regRole);
    setLoading(false);
    if (result.success) {
      onLoginSuccess(result.user, 'registrace');
    } else {
      setError(result.error);
    }
  };

  // ── Google Login ──
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const result = await firebaseAuth.loginWithGoogle();
    if (result.success) {
      setLoading(false);
      onLoginSuccess(result.user, 'Google');
    } else if (result.pending) {
      setSuccessMsg('Přesměrovávám na Google přihlášení...');
    } else {
      setLoading(false);
      setError(result.error || 'Nepodařilo se přihlásit přes Google.');
    }
  };

  // ── Logout ──
  const handleLogout = async () => {
    setLoading(true);
    await firebaseAuth.logout();
    setCurrentUser(null);
    setLoading(false);
    setActiveTab('login');
    setShowEmailForm(false);
  };

  // ═══════════════════════════════════════════
  // LOGGED IN → Profile view (inside modal)
  // ═══════════════════════════════════════════
  if (currentUser) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-sm w-full p-5 flex flex-col gap-4 shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-on-surface">Profil</h2>
            {!isForceAuth && onClose && (
              <button onClick={onClose} className="text-outline hover:text-on-surface p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Toast */}
          {successMsg && (
            <div className="bg-secondary-container text-on-secondary-container p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border border-secondary">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
            </div>
          )}
          {error && (
            <div className="bg-error-container/30 text-error p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border border-error/40">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* User card */}
          <div className="flex items-center gap-3 bg-surface-container p-4 rounded-xl border border-outline-variant">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-primary shrink-0 shadow-md"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-on-surface truncate">{currentUser.name}</h3>
              <p className="text-xs text-outline truncate">{currentUser.email}</p>
              <span className="text-[10px] font-mono text-secondary mt-1 block">
                {currentUser.provider === 'google' ? 'Google OAuth' : 'E-mail'}
              </span>
            </div>
          </div>

          {/* WebAuthn manage */}
          {webAuthnSupported && (
            <div className="bg-surface-container rounded-xl border border-outline-variant p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-on-surface">Biometrické přihlášení</span>
                {hasCredential && (
                  <span className="ml-auto text-[10px] font-mono bg-secondary/15 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full font-bold">
                    AKTIVNÍ
                  </span>
                )}
              </div>

              {showBioRegister ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-outline">Přihlašovat se příště otiskem prstu?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegisterBiometric}
                      disabled={bioLoading}
                      className="flex-1 py-2 bg-primary text-on-primary-container font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      <Fingerprint className="w-4 h-4" />
                      {bioLoading ? 'Registruji...' : 'Aktivovat'}
                    </button>
                    <button
                      onClick={() => { setShowBioRegister(false); if (onClose) onClose(); }}
                      className="px-4 py-2 bg-surface-variant text-on-surface-variant text-xs font-semibold rounded-xl border border-outline-variant active:scale-95"
                    >
                      Přeskočit
                    </button>
                  </div>
                </div>
              ) : hasCredential ? (
                <button onClick={handleRemoveBiometric} className="flex items-center gap-1.5 text-xs text-error font-semibold">
                  <Trash2 className="w-3.5 h-3.5" /> Odregistrovat biometrii
                </button>
              ) : (
                <button
                  onClick={handleRegisterBiometric}
                  disabled={bioLoading}
                  className="w-full py-2 bg-primary/10 border border-primary/30 text-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Fingerprint className="w-4 h-4" />
                  {bioLoading ? 'Registruji...' : 'Aktivovat otisk prstu'}
                </button>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            disabled={loading}
            onClick={handleLogout}
            className="w-full py-3 bg-error-container/30 border border-error/40 text-error font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 shadow-sm"
          >
            <LogOut className="w-4 h-4" /> Odhlásit se
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // NOT LOGGED IN → Branded fullscreen login
  // ═══════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto"
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 35%, #0c4a3e 70%, #064e3b 100%)',
      }}
    >
      {/* Subtle animated glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-teal-400/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6 py-8">

        {/* Logo + Branding */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
            <span className="text-4xl font-black text-white tracking-tighter">BLP</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">BLP Film</h1>
            <p className="text-sm text-slate-400 mt-0.5">Inventory Management System</p>
          </div>
        </div>

        {/* Toast messages */}
        {successMsg && (
          <div className="w-full bg-emerald-500/20 text-emerald-300 p-3 rounded-xl font-bold text-xs flex items-center gap-2 border border-emerald-500/30 backdrop-blur-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
          </div>
        )}
        {error && (
          <div className="w-full bg-red-500/20 text-red-300 p-3 rounded-xl font-bold text-xs flex items-center gap-2 border border-red-500/30 backdrop-blur-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── Biometric login (hero button when available) ── */}
        {webAuthnSupported && hasCredential && (
          <>
            <button
              type="button"
              disabled={bioLoading}
              onClick={handleBiometricLogin}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              <Fingerprint className="w-6 h-6" />
              {bioLoading ? 'Ověřuji...' : 'Přihlásit otiskem / Face ID'}
            </button>

            <div className="relative flex items-center justify-center w-full">
              <div className="border-t border-slate-600 w-full" />
              <span className="bg-transparent px-3 text-[10px] font-mono text-slate-500 uppercase shrink-0 absolute backdrop-blur-sm">
                nebo
              </span>
            </div>
          </>
        )}

        {/* ── Google button ── */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleLogin}
          className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 shadow-lg active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {loading ? 'Přihlašuji...' : 'Pokračovat přes Google'}
        </button>

        {/* ── Email option (collapsed by default) ── */}
        <button
          type="button"
          onClick={() => setShowEmailForm(!showEmailForm)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          Přihlásit se e-mailem a heslem
          {showEmailForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showEmailForm && (
          <div className="w-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 flex flex-col gap-3">
            {/* Tab switcher */}
            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setError(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'login' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <LogIn className="w-3 h-3" /> Přihlášení
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'register' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <UserPlus className="w-3 h-3" /> Registrace
              </button>
            </div>

            {/* Login form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-2.5">
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 outline-none"
                />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl text-sm active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {loading ? 'Přihlašuji...' : 'Přihlásit se'}
                </button>
              </form>
            )}

            {/* Register form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-2.5">
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Jméno a Příjmení"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 outline-none"
                />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 outline-none"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Heslo (min. 6 znaků)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl text-sm active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {loading ? 'Registruji...' : 'Vytvořit účet'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-slate-600 font-mono text-center mt-4">
          BLP INVENTORY v2.0 · Lighting Equipment Management
        </p>
      </div>
    </div>
  );
};
