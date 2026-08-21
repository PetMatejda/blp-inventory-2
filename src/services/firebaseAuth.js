import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  db,
  doc,
  setDoc,
  getDoc,
} from './firebase';

const USER_ROLE_KEY = 'blp_user_role_v2';

export const firebaseAuth = {
  /**
   * Real Google OAuth Login
   */
  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Fetch or create user profile doc in Firestore /users/{uid}
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);

      let role = 'USER';
      if (snap.exists()) {
        role = snap.data().role || 'USER';
      } else {
        // Default Petr M. or gaffer emails to ADMIN, others to USER
        role = user.email && (user.email.includes('petr') || user.email.includes('gaffer') || user.email.includes('blp')) ? 'ADMIN' : 'USER';
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          role: role,
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
          updatedAt: new Date().toISOString(),
        });
      }

      const userObj = {
        id: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        role: role,
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
        provider: 'google',
      };

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Google Sign-In Error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Real Email & Password Login
   */
  async loginWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);

      let role = 'USER';
      let name = user.email.split('@')[0];

      if (snap.exists()) {
        role = snap.data().role || 'USER';
        name = snap.data().name || name;
      }

      const userObj = {
        id: user.uid,
        name: name,
        email: user.email,
        role: role,
        avatar: snap.data()?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
        provider: 'email',
      };

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Email Login Error:', err);
      return { success: false, error: err.message };
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
        role: role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        provider: 'email',
      };

      // Save user role and profile to Firestore /users/{uid}
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: user.email,
        role: role,
        avatar: userObj.avatar,
        createdAt: new Date().toISOString(),
      });

      localStorage.setItem('blp_auth_user_v2', JSON.stringify(userObj));
      return { success: true, user: userObj };
    } catch (err) {
      console.error('[FirebaseAuth] Registration Error:', err);
      return { success: false, error: err.message };
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
   * Subscribe to Auth State Changes
   */
  onAuthChange(callback) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const role = snap.exists() ? snap.data().role : 'USER';
        const name = snap.exists() ? snap.data().name : firebaseUser.displayName || firebaseUser.email.split('@')[0];

        const userObj = {
          id: firebaseUser.uid,
          name: name,
          email: firebaseUser.email,
          role: role,
          avatar: snap.data()?.avatar || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firebaseUser.email)}`,
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
