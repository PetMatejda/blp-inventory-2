import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
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
  // All team members have full ADMIN (Lead Gaffer) access
  return 'ADMIN';
};


const syncUserProfile = (firebaseUser, fallbackRole) => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    setDoc(userRef, {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Uživatel',
      email: firebaseUser.email || '',
      role: fallbackRole,
      avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'user')}`,
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
  } catch (err) {
    // Non-fatal
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
      if (isGenuineWebview()) {
        console.log('[FirebaseAuth] Genuine webview detected, using redirect flow');
        await signInWithRedirect(auth, googleProvider);
        return { success: false, pending: true, error: 'Přesměrovávám na Google přihlášení...' };
      }

      let result = null;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        console.warn('[FirebaseAuth] Google Popup failed:', popupErr.code, popupErr.message);
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

      const role = resolveRole(result.user.email);
      const userObj = buildUserObj(result.user, role, result.user.displayName, result.user.photoURL);
      syncUserProfile(result.user, role);

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
   * Real Email & Password Login (with strict password verification for blp / blpblp)
   */
  async loginWithEmail(email, password) {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      // Generic test login requested for testing phase (blp / blpblp)
      if (
        cleanEmail === 'blp' || cleanEmail === 'aaaa' || cleanEmail === 'admin' || cleanEmail === 'test'
      ) {
        if (cleanPass !== 'blpblp' && cleanPass !== 'bbbb') {
          return { success: false, error: 'Nesprávné heslo pro účet blp. (Správné heslo: blpblp)' };
        }

        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch (anonErr) {
          console.warn('[FirebaseAuth] Anonymous auth note:', anonErr.message);
        }

        const testAdminUser = {
          id: auth.currentUser?.uid || 'test-admin-blp',
          name: 'BLP Admin (Test)',
          email: 'admin@balloonlightprag.cz',
          role: 'ADMIN',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin_blp_test',
          provider: 'test_auth',
        };
        localStorage.setItem('blp_auth_user_v2', JSON.stringify(testAdminUser));
        return { success: true, user: testAdminUser };
      }


      if (!cleanPass) {
        return { success: false, error: 'Zadejte prosím heslo.' };
      }

      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const role = resolveRole(result.user.email);
      syncUserProfile(result.user, role);
      const userObj = buildUserObj(result.user, role, result.user.displayName, result.user.photoURL);

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
      const assignedRole = resolveRole(email);
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

      const userObj = {
        id: result.user.uid,
        name,
        email: result.user.email,
        role: assignedRole,
        avatar,
        provider: 'email',
      };

      syncUserProfile(result.user, assignedRole);
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
    } catch (err) {
      console.error('[FirebaseAuth] Logout Error:', err);
    } finally {
      localStorage.removeItem('blp_auth_user_v2');
    }
    return { success: true };
  },

  /**
   * Subscribe to Auth State Changes & Handle Redirect Login Result
   */
  onAuthChange(callback) {
    // Check for redirect result when returning from Google Auth redirect
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        const role = resolveRole(result.user.email);
        syncUserProfile(result.user, role);
        const userObj = buildUserObj(result.user, role, result.user.displayName, result.user.photoURL);
        localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
        callback(userObj);
      }
    }).catch(err => {
      if (err.code !== 'auth/no-redirect-result') {
        console.warn('[FirebaseAuth] Redirect result warning:', err.code, err.message);
      }
    });

    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const role = resolveRole(firebaseUser.email);
        syncUserProfile(firebaseUser, role);
        const userObj = buildUserObj(firebaseUser, role, firebaseUser.displayName, firebaseUser.photoURL);
        localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
        callback(userObj);
      } else {
        const localUserRaw = localStorage.getItem('blp_auth_user_v2');
        if (localUserRaw) {
          try {
            const localUser = JSON.parse(localUserRaw);
            if (localUser?.provider === 'test_auth') {
              if (!auth.currentUser) {
                signInAnonymously(auth).catch(() => {});
              }
              callback(localUser);
              return;
            }
          } catch {}
        }
        callback(null);
      }
    });
  }
};

