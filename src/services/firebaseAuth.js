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
      const cleanEmail = (user.email || '').toLowerCase();

      // Check if Admin email (petmatejda@gmail.com or blp/gaffer admins)
      if (cleanEmail === 'petmatejda@gmail.com' || cleanEmail.includes('petr') || cleanEmail.includes('gaffer') || cleanEmail.includes('admin')) {
        role = 'ADMIN';
      }

      if (snap.exists()) {
        role = snap.data().role || role;
      } else {
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

      let role = (user.email && user.email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : 'USER';
      let name = user.email.split('@')[0];

      if (snap.exists()) {
        role = snap.data().role || role;
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
        role: (email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        provider: 'email',
      };

      // Save user role and profile to Firestore /users/{uid}
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: user.email,
        role: userObj.role,
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
        const defaultRole = (firebaseUser.email && firebaseUser.email.toLowerCase() === 'petmatejda@gmail.com') ? 'ADMIN' : 'USER';
        const role = snap.exists() ? snap.data().role : defaultRole;
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
