// firebase-admin for server functions. Credentials: FIREBASE_SERVICE_ACCOUNT (the
// service-account JSON, plain or base64). The Admin SDK bypasses firestore.rules –
// every endpoint must check the caller itself (see mcpAuth.js / approvedEmails.js).
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export { FieldValue };

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text);
}

export const isAdminConfigured = () => !!process.env.FIREBASE_SERVICE_ACCOUNT;

function adminApp() {
  return getApps()[0] || initializeApp({ credential: cert(serviceAccount()) });
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
