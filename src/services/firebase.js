import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth';

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  limit,
  waitForPendingWrites,
  where,
  increment,
  arrayUnion,
  arrayRemove,
  connectFirestoreEmulator,
} from 'firebase/firestore';

// Firebase configuration with environment variables and production fallbacks
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyAmYzBZ5vO4uR0f229Iv6isgeGC9EIeuPU",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "blp-inventory.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "blp-inventory",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "blp-inventory.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "270493687488",
  appId: env.VITE_FIREBASE_APP_ID || "1:270493687488:web:56ab0bdb9c41b0f58fd725",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-P3YYE0EM5H",
};

// Initialize Firebase App safely
let appInstance;
try {
  appInstance = initializeApp(firebaseConfig);
} catch (err) {
  console.warn('[Firebase] Warning during initializeApp:', err);
  try {
    appInstance = initializeApp(firebaseConfig, 'BLP_FALLBACK');
  } catch (e2) {
    console.error('[Firebase] Fatal initializeApp error:', e2);
  }
}

export const app = appInstance;

// Initialize Firebase Auth
export const auth = getAuth(app);
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] setPersistence note:', err.message);
  });
} catch (persistErr) {
  console.warn('[Firebase] setPersistence error:', persistErr);
}
export const googleProvider = new GoogleAuthProvider();


// Firestore with a persistent offline cache (IndexedDB, owned by one tab).
// Reads work offline from the cache and writes are queued and survive app
// restarts until the device is back online.
let firestore;
try {
  firestore = initializeFirestore(app, {
    // Single-tab cache: sharing one IndexedDB cache between tabs proved fragile on
    // desktop Chrome (hangs / Out of Memory). Other tabs fall back to memory cache.
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: false }) }),
  });
} catch (err) {
  console.warn('[Firebase] Persistent cache unavailable, using memory cache:', err);
  firestore = getFirestore(app);
}
export const db = firestore;

// Local development against the Firebase emulators (npm run emulators):
// start Vite with VITE_USE_EMULATORS=true and VITE_FIREBASE_PROJECT_ID=demo-blp.
if (env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.info('[Firebase] Using local emulators (auth :9099, firestore :8080)');
}


export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  limit,
  waitForPendingWrites,
  where,
  increment,
  arrayUnion,
  arrayRemove,
};

