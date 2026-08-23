import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import {
  INITIAL_JOBS,
  INITIAL_JOB_ITEMS,
  INITIAL_VEHICLES,
  INITIAL_CONSUMABLES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CATALOG
} from '../src/mockData/initialData.js';

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
const db = getFirestore(app);

async function pushMasterDataToFirestore() {
  console.log('Pushing master catalog to Firestore...');
  console.log('Catalog items count:', INITIAL_CATALOG.length);
  console.log('Jobs count:', INITIAL_JOBS.length);
  console.log('Job items count:', INITIAL_JOB_ITEMS.length);

  const mainRef = doc(db, 'inventory_store', 'blp_main_store');
  await setDoc(mainRef, {
    updatedAt: new Date().toISOString(),
    pushedBy: 'initial_master_seed',
    version: '3.0',
    jobs: INITIAL_JOBS,
    jobItems: INITIAL_JOB_ITEMS,
    catalog: INITIAL_CATALOG,
    consumables: INITIAL_CONSUMABLES,
    auditLogs: INITIAL_AUDIT_LOGS,
    vehicles: INITIAL_VEHICLES
  });

  console.log('✅ Successfully seeded Cloud Firestore with complete Master Catalog v3!');
  process.exit(0);
}

pushMasterDataToFirestore().catch(err => {
  console.error('❌ Error seeding Firestore:', err);
  process.exit(1);
});
