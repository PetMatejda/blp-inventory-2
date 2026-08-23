import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

async function testWrite() {
  const cred = await signInWithEmailAndPassword(auth, 'blp_system_admin@blp.cz', 'blpblp2026!');
  console.log('Signed in as:', cred.user.email, cred.user.uid);

  const mainRef = doc(db, 'inventory_store', 'blp_main_store');
  const now = new Date().toISOString();
  await setDoc(mainRef, {
    updatedAt: now,
    pushedBy: 'test_node_write',
    testSync: true
  }, { merge: true });

  console.log('✅ WRITE TO inventory_store/blp_main_store SUCCESSFUL at:', now);
  const snap = await getDoc(mainRef);
  console.log('Read back snap updatedAt:', snap.data().updatedAt);
  process.exit(0);
}

testWrite().catch(err => {
  console.error('❌ Write failed:', err);
  process.exit(1);
});
