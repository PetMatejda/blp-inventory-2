// firebase-admin for server functions. Credentials: FIREBASE_SERVICE_ACCOUNT (the
// service-account JSON, plain or base64). The Admin SDK bypasses firestore.rules –
// every endpoint must check the caller itself (see tokens.js / approvedEmails.js).
//
// firebase-admin/auth is deliberately NOT used: its jwks-rsa require()s the ESM-only
// `jose`, which crashes on Vercel's Node runtime. Firebase ID tokens are verified with
// `jose` directly (verifyFirebaseIdToken below), as Firebase documents for 3rd-party JWT libs.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

/** Verifies a Firebase Auth ID token → { uid, email, email_verified, name }. Throws when invalid. */
export async function verifyFirebaseIdToken(idToken, projectId = serviceAccount().project_id) {
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (!payload.sub) throw new Error('token without subject');
  return { uid: payload.sub, email: payload.email || '', email_verified: payload.email_verified === true, name: payload.name || '' };
}
