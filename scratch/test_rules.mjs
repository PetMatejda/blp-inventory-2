import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';

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

async function testCollections() {
  const cred = await signInWithEmailAndPassword(auth, 'blp_system_admin@blp.cz', 'blpblp2026!');
  console.log('Signed in as:', cred.user.email, cred.user.uid);

  const testPaths = [
    ['inventory_store', 'blp_main_store'],
    ['inventory', 'shared_state'],
    ['inventory', 'main'],
    ['blp_inventory', 'store'],
    ['data', 'global'],
    ['users', cred.user.uid],
    ['jobs', 'test_job'],
  ];

  for (const [col, docId] of testPaths) {
    try {
      const ref = doc(db, col, docId);
      await setDoc(ref, { ping: 'pong', time: new Date().toISOString() }, { merge: true });
      console.log(`✅ WRITE ALLOWED for collection: "${col}/${docId}"`);
    } catch (e) {
      console.log(`❌ WRITE DENIED for collection: "${col}/${docId}" (${e.code})`);
    }
  }

  process.exit(0);
}

testCollections().catch(console.error);
