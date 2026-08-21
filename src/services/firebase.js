import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmYzBZ5vO4uR0f229Iv6isgeGC9EIeuPU",
  authDomain: "blp-inventory.firebaseapp.com",
  projectId: "blp-inventory",
  storageBucket: "blp-inventory.firebasestorage.app",
  messagingSenderId: "270493687488",
  appId: "1:270493687488:web:56ab0bdb9c41b0f58fd725",
  measurementId: "G-P3YYE0EM5H"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

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
