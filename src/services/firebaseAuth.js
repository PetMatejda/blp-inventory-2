import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  db,
  doc,
  setDoc,
  getDoc,
} from './firebase';

/**
 * Determines if we're running in a genuine embedded WebView
 * (Android WebView, iOS WKWebView, in-app browsers like Instagram/Facebook).
 * NOTE: PWA (display-mode: standalone) is NOT a webview — popups work fine there.
 */
const isGenuineWebview = () => {
  const ua = navigator.userAgent || '';
  return (
    /wv|WebView/i.test(ua) ||
    (/Android/i.test(ua) && !/Chrome/i.test(ua)) ||
    /FBAN|FBAV|Instagram|Line\//i.test(ua)
  );
};

const buildUserObj = (firebaseUser, role, name, avatar) => ({
  id: firebaseUser.uid,
  name: name || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Uživatel'),
  email: firebaseUser.email || '',
  role: role || 'USER',
  avatar: avatar || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'user')}`,
  provider: firebaseUser.providerData?.[0]?.providerId || 'firebase',
});

const resolveRole = (email) => {
  const e = (email || '').toLowerCase();
  if (e === 'petmatejda@gmail.com' || e.includes('gaffer') || e.includes('admin')) return 'ADMIN';
  return 'USER';
};

const syncUserProfile = async (firebaseUser, fallbackRole) => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const d = snap.data();
      return {
        role: d.role || fallbackRole,
        name: d.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel',
        avatar: d.avatar || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'user')}`,
      };
    } else {
      const role = fallbackRole;
      const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel';
      const avatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'user')}`;
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        name,
        email: firebaseUser.email || '',
        role,
        avatar,
        updatedAt: new Date().toISOString(),
      });
      return { role, name, avatar };
    }
  } catch (dbErr) {
    console.warn('[FirebaseAuth] Non-fatal Firestore profile sync error:', dbErr.message);
    return {
      role: fallbackRole,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel',
      avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'user')}`,
    };
  }
};

export const firebaseAuth = {
  /**
   * Google OAuth Login
   * Strategy: ALWAYS try popup first (works on desktop, mobile Chrome, PWA).
   * Only fall back to redirect on genuine embedded webviews where popups fail.
   */
  async loginWithGoogle() {
    try {
      // Genuine webviews (Instagram, Facebook in-app browser) can't do popups at all
      if (isGenuineWebview()) {
        console.log('[FirebaseAuth] Genuine webview detected, using redirect flow');
        await signInWithRedirect(auth, googleProvider);
        return { success: false, pending: true, error: 'Přesměrovávám na Google přihlášení...' };
      }

      // Default: try popup (works on desktop, mobile Chrome, PWA)
      let result = null;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        console.warn('[FirebaseAuth] Google Popup failed:', popupErr.code, popupErr.message);
        // If popup was blocked/closed/unsupported → fall back to redirect
        const redirectCodes = [
          'auth/popup-blocked',
          'auth/popup-closed-by-user',
          'auth/cancelled-popup-request',
          'auth/operation-not-supported-in-this-environment',
          'auth/internal-error',
        ];
        if (redirectCodes.includes(popupErr.code)) {
          console.log('[FirebaseAuth] Falling back to redirect flow');
          await signInWithRedirect(auth, googleProvider);
          return { success: false, pending: true, error: 'Přesměrovávám na bezpečné Google přihlášení...' };
        }
        throw popupErr;
      }

      if (!result?.user) {
        return { success: false, error: 'Google nezadal přihlašovací údaje.' };
      }

      const fallbackRole = resolveRole(result.user.email);
      const profile = await syncUserProfile(result.user, fallbackRole);
      const userObj = buildUserObj(result.user, profile.role, profile.name, profile.avatar);

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Google Sign-In Error:', err);
      let message = err.message || 'Nepodařilo se přihlásit přes Google.';
      if (err.code === 'auth/popup-blocked') {
        message = 'Prohlížeč zablokoval vyskakovací okno. Zkuste e-mail nebo povolte pop-upy.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        message = 'Přihlášení bylo zrušeno uzavřením okna Google.';
      } else if (err.code === 'auth/unauthorized-domain') {
        message = 'Tato doména není schválena ve Firebase Console (Authentication → Authorized Domains).';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Chyba sítě. Zkontrolujte internetové připojení.';
      }
      return { success: false, error: message };
    }
  },


  /**
   * Real Email & Password Login
   */
  async loginWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fallbackRole = resolveRole(result.user.email);
      const profile = await syncUserProfile(result.user, fallbackRole);
      const userObj = buildUserObj(result.user, profile.role, profile.name, profile.avatar);

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Email Login Error:', err);
      let message = err.message || 'Chyba při přihlašování e-mailem.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Nesprávný e-mail nebo heslo. Zkontrolujte zadání nebo zaregistrujte nový účet.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Příliš mnoho pokusů. Zkuste to znovu za chvíli.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Chyba sítě. Zkontrolujte internetové připojení.';
      }
      return { success: false, error: message };
    }
  },

  /**
   * Real Email & Password Registration
   */
  async registerWithEmail(name, email, password, role = 'USER') {
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const assignedRole = (email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : role;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

      const userObj = {
        id: result.user.uid,
        name,
        email: result.user.email,
        role: assignedRole,
        avatar,
        provider: 'email',
      };

      try {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          name,
          email: result.user.email,
          role: assignedRole,
          avatar,
          createdAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('[FirebaseAuth] Non-fatal user doc creation warning:', dbErr.message);
      }

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Registration Error:', err);
      let message = err.message || 'Chyba při vytváření účtu.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'Tento e-mail již má registrovaný účet! Přihlaste se v záložce Přihlášení.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Heslo musí mít alespoň 6 znaků.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Neplatná e-mailová adresa.';
      }
      return { success: false, error: message };
    }
  },

  /**
   * Logout User
   */
  async logout() {
    try {
      await signOut(auth);
      localStorage.removeItem('blp_auth_user_v2');
      return { success: true };
    } catch (err) {
      console.error('[FirebaseAuth] Logout Error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Subscribe to Auth State Changes & Handle Redirect Login Result
   */
  onAuthChange(callback) {
    // Check for redirect result when returning from Google Auth redirect
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const fallbackRole = resolveRole(result.user.email);
        const profile = await syncUserProfile(result.user, fallbackRole);
        const userObj = buildUserObj(result.user, profile.role, profile.name, profile.avatar);
        localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
        callback(userObj);
      }
    }).catch(err => {
      // Non-fatal: user may not have gone through redirect
      if (err.code !== 'auth/no-redirect-result') {
        console.warn('[FirebaseAuth] Redirect result warning:', err.code, err.message);
      }
    });

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const fallbackRole = resolveRole(firebaseUser.email);
        const profile = await syncUserProfile(firebaseUser, fallbackRole);
        const userObj = buildUserObj(firebaseUser, profile.role, profile.name, profile.avatar);
        localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
        callback(userObj);
      } else {
        callback(null);
      }
    });
  }
};
