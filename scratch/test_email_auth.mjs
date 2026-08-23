import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAmYzBZ5vO4uR0f229Iv6isgeGC9EIeuPU",
  authDomain: "blp-inventory.firebaseapp.com",
  projectId: "blp-inventory",
  storageBucket: "blp-inventory.firebasestorage.app",
  messagingSenderId: "270493687488",
  appId: "1:270493687488:web:56ab0bdb9c41b0f58fd725",
  measurementId: "G-P3YYE0EM5H"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testEmailAuth() {
  const testEmail = 'blp_system_admin@blp.cz';
  const testPass = 'blpblp2026!';

  console.log('Trying signInWithEmailAndPassword for', testEmail);
  try {
    const cred = await signInWithEmailAndPassword(auth, testEmail, testPass);
    console.log('✅ Signed in successfully! UID:', cred.user.uid);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      console.log('User does not exist yet. Creating user...');
      try {
        const createCred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
        console.log('✅ User created successfully! UID:', createCred.user.uid);
      } catch (createErr) {
        console.error('❌ Error creating user:', createErr.code, createErr.message);
        return;
      }
    } else {
      console.error('❌ Sign in error:', err.code, err.message);
      return;
    }
  }

  // Now test reading and writing Firestore!
  try {
    const mainRef = doc(db, 'inventory_store', 'blp_main_store');
    const snap = await getDoc(mainRef);
    if (snap.exists()) {
      const data = snap.data();
      console.log('✅ FIRESTORE READ SUCCESSFUL!');
      console.log('UpdatedAt:', data.updatedAt);
      console.log('Jobs:', (data.jobs || []).map(j => j.name));
      console.log('Job items count:', (data.jobItems || []).length);
    } else {
      console.log('Firestore document does not exist yet.');
    }
  } catch (fsErr) {
    console.error('❌ Firestore read error:', fsErr.code, fsErr.message);
  }
}

testEmailAuth().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
