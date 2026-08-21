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

export const firebaseAuth = {
  /**
   * Real Google OAuth Login with Redirect fallback for mobile / popup blockers
   */
  async loginWithGoogle() {
    try {
      let result = null;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        console.warn('[FirebaseAuth] Google Popup failed or blocked, redirecting...', popupErr);
        if (
          popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/popup-closed-by-user' ||
          popupErr.code === 'auth/cancelled-popup-request'
        ) {
          await signInWithRedirect(auth, googleProvider);
          return { success: false, error: 'Přesměrovávám na bezpečné přihlášení v účtu Google...' };
        }
        throw popupErr;
      }

      if (!result || !result.user) {
        return { success: false, error: 'Google nezadal přihlašovací údaje.' };
      }

      const user = result.user;
      let role = 'USER';
      const cleanEmail = (user.email || '').toLowerCase();

      // Auto-assign ADMIN for petmatejda@gmail.com or lead admins
      if (cleanEmail === 'petmatejda@gmail.com' || cleanEmail.includes('petr') || cleanEmail.includes('gaffer') || cleanEmail.includes('admin')) {
        role = 'ADMIN';
      }

      // Safely check or save Firestore user profile without crashing on network/rule hiccup
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          role = snap.data().role || role;
        } else {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || (user.email ? user.email.split('@')[0] : 'Uživatel'),
            email: user.email || '',
            role: role,
            avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || 'user')}`,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (dbErr) {
        console.warn('[FirebaseAuth] Non-fatal Firestore profile sync error:', dbErr);
      }

      const userObj = {
        id: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Uživatel'),
        email: user.email || '',
        role: role,
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || 'user')}`,
        provider: 'google',
      };

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Google Sign-In Error:', err);
      let message = err.message || 'Nepodařilo se přihlásit přes Google.';
      if (err.code === 'auth/popup-blocked') {
        message = 'Váš prohlížeč zablokoval vyskakovací okno. Použijte raději e-mail a heslo.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        message = 'Přihlášení bylo zrušeno uzavřením okna Google.';
      } else if (err.code === 'auth/unauthorized-domain') {
        message = 'Doména není schválena ve Firebase Console (Authentication -> Authorized Domains).';
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
      const user = result.user;

      let role = (user.email && user.email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : 'USER';
      let name = user.email ? user.email.split('@')[0] : 'Uživatel';
      let avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || 'user')}`;

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          role = snap.data().role || role;
          name = snap.data().name || name;
          avatar = snap.data().avatar || avatar;
        }
      } catch (dbErr) {
        console.warn('[FirebaseAuth] Non-fatal profile fetch warning:', dbErr);
      }

      const userObj = {
        id: user.uid,
        name: name,
        email: user.email,
        role: role,
        avatar: avatar,
        provider: 'email',
      };

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Email Login Error:', err);
      let message = err.message || 'Chyba při přihlašování e-mailem.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Nespávný e-mail nebo heslo. Zkontrolujte zadání nebo zaregistrujte nový účet.';
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
      const user = result.user;

      const userObj = {
        id: user.uid,
        name: name,
        email: user.email,
        role: (email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        provider: 'email',
      };

      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name,
          email: user.email,
          role: userObj.role,
          avatar: userObj.avatar,
          createdAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('[FirebaseAuth] Non-fatal user doc creation warning:', dbErr);
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
   * Subscribe to Auth State Changes & Handle Redirect Login
   */
  onAuthChange(callback) {
    // Check for redirect result when returning from Google Auth redirect
    getRedirectResult(auth).then((result) => {
      if (result && result.user) {
        const user = result.user;
        const cleanEmail = (user.email || '').toLowerCase();
        const role = (cleanEmail === 'petmatejda@gmail.com' || cleanEmail.includes('petr') || cleanEmail.includes('gaffer') || cleanEmail.includes('admin')) ? 'ADMIN' : 'USER';

        const userObj = {
          id: user.uid,
          name: user.displayName || (user.email ? user.email.split('@')[0] : 'Uživatel'),
          email: user.email || '',
          role: role,
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || 'user')}`,
          provider: 'google',
        };
        localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
        callback(userObj);
      }
    }).catch(err => {
      console.warn('[FirebaseAuth] Redirect result warning:', err);
    });

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = (firebaseUser.email && firebaseUser.email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : 'USER';
        let name = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Uživatel');
        let avatar = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email || 'user')}`;

        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            role = snap.data().role || role;
            name = snap.data().name || name;
            avatar = snap.data().avatar || avatar;
          }
        } catch (dbErr) {
          console.warn('[FirebaseAuth] Non-fatal auth listener doc warning:', dbErr);
        }

        const userObj = {
          id: firebaseUser.uid,
          name: name,
          email: firebaseUser.email,
          role: role,
          avatar: avatar,
          provider: firebaseUser.providerData[0]?.providerId || 'firebase',
        };

        localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
        callback(userObj);
      } else {
        callback(null);
      }
    });
  }
};
