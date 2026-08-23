import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
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

async function inspectFirestore() {
  console.log('Authenticating anonymously...');
  const cred = await signInAnonymously(auth);
  console.log('Authenticated UID:', cred.user.uid);

  const mainRef = doc(db, 'inventory_store', 'blp_main_store');
  const snap = await getDoc(mainRef);
  if (snap.exists()) {
    const data = snap.data();
    console.log('✅ Firestore Document exists!');
    console.log('UpdatedAt:', data.updatedAt);
    console.log('PushedBy:', data.pushedBy);
    console.log('Version:', data.version);
    console.log('Jobs count:', data.jobs?.length || 0);
    console.log('Jobs names:', (data.jobs || []).map(j => ({ id: j.id, name: j.name })));
    console.log('Job items count:', data.jobItems?.length || 0);
    console.log('Job items for Velká amerika:', (data.jobItems || []).filter(i => i.jobId?.includes('amerika') || i.name?.includes('amerika')));
    console.log('All Job items sample:', (data.jobItems || []).slice(0, 5).map(i => ({ id: i.id, jobId: i.jobId, name: i.name, qty: i.quantityRequested })));
    console.log('Catalog items count:', data.catalog?.length || 0);
  } else {
    console.log('❌ Firestore Document blp_main_store does not exist.');
  }
  process.exit(0);
}

inspectFirestore().catch(err => {
  console.error('❌ Error inspecting Firestore:', err);
  process.exit(1);
});
