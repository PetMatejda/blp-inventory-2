// Seeds the LOCAL Firebase emulators for manual testing (never touches production).
//
//   1. npm run emulators                    (keep running)
//   2. node scripts/emulator-seed.mjs       (in another terminal)
//   3. VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-blp npm run dev
//
// Creates the legacy single document (to exercise the migration) and a verified
// test user from the approved list. Test login: admin@blp.cz / emulator-test-123
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import {
  INITIAL_JOBS, INITIAL_JOB_ITEMS, INITIAL_CATALOG, INITIAL_CONSUMABLES, INITIAL_AUDIT_LOGS,
} from '../src/mockData/initialData.js';

const PROJECT = 'demo-blp';
const AUTH = 'http://127.0.0.1:9099';
const TEST_USER = { email: 'admin@blp.cz', password: 'emulator-test-123', displayName: 'Emulátor Tester' };

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const legacy = {
    jobs: INITIAL_JOBS,
    jobItems: [...INITIAL_JOB_ITEMS, { ...INITIAL_JOB_ITEMS[0], id: 'deleted-dup' }],
    catalog: INITIAL_CATALOG,
    consumables: INITIAL_CONSUMABLES,
    auditLogs: INITIAL_AUDIT_LOGS,
    deletedJobItemIds: ['deleted-dup'],
    deletedJobIds: [],
    deletedCatalogIds: [],
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(ctx.firestore(), 'inventory_store/blp_main_store'), JSON.parse(JSON.stringify(legacy)));
});
await env.cleanup();

// Auth emulator: reset accounts, create a verified test user.
const owner = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
const signUp = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password, returnSecureToken: true }),
}).then((r) => r.json());
await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
  method: 'POST', headers: owner,
  body: JSON.stringify({ localId: signUp.localId, emailVerified: true, displayName: TEST_USER.displayName }),
});

console.log(`Seeded legacy store (${INITIAL_JOBS.length} jobs, ${INITIAL_JOB_ITEMS.length} items) and user ${TEST_USER.email}`);
