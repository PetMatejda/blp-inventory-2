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
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
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


// Initialize Firestore safely
export const db = getFirestore(app);


export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
};

