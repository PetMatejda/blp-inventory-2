import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAmYzBZ5vO4uR0f229Iv6isgeGC9EIeuPU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "blp-inventory.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blp-inventory",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blp-inventory.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "270493687488",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:270493687488:web:56ab0bdb9c41b0f58fd725",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-P3YYE0EM5H",
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
export const googleProvider = new GoogleAuthProvider();


// Initialize Firestore safely with offline persistent cache fallback
let firestoreInstance;
try {
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } else {
    firestoreInstance = getFirestore(app);
  }
} catch (e) {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
