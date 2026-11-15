// Personal MCP access tokens and caller identity.
//
// Token: `blp_mcp_<43 chars>` shown to the user once; Firestore keeps only its
// SHA-256 (doc id in mcpTokens) with { uid, email, name, label, scope, createdAt,
// lastUsedAt, revoked }. scope 'read' = read tools only, 'write' = also write tools.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isApprovedEmail } from './approvedEmails.js';

export const TOKEN_PREFIX = 'blp_mcp_';
export const SCOPES = ['read', 'write'];
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export const generateToken = () => TOKEN_PREFIX + randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

const sameSecret = (given, expected) => {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The token a request carries, in this order: Authorization: Bearer, X-API-Key,
 * X-BLP-Token, ?key= in the URL (Claude custom connectors may send no headers).
 */
export function tokenFromRequest(headers = {}, url = '') {
  const bearer = /^Bearer\s+(.+)$/i.exec(String(headers.authorization || ''));
  if (bearer) return bearer[1].trim();
  for (const name of ['x-api-key', 'x-blp-token']) {
    const v = headers[name];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/^Bearer\s+/i, '');
  }
  try { return new URL(url || '', 'http://localhost').searchParams.get('key')?.trim() || ''; } catch { return ''; }
}

/**
 * Who is calling. Returns { uid, email, name, scope, label, tokenId } or
 * { error } with the reason (never the token).
 * The legacy shared spike token (MCP_SPIKE_TOKEN) still works, read-only.
 */
export async function resolveIdentity(token, { ds, spikeToken = '', now = () => new Date() }) {
  if (!token) return { error: 'missing token' };
  if (spikeToken && sameSecret(token, spikeToken)) {
    return { uid: 'spike', email: '', name: 'Sdílený token (spike)', scope: 'read', label: 'spike', tokenId: 'spike' };
  }
  if (!token.startsWith(TOKEN_PREFIX)) return { error: 'unknown token' };
  const hash = hashToken(token);
  const doc = await ds.getToken(hash);
  if (!doc) return { error: 'unknown token' };
  if (doc.revoked) return { error: 'revoked token' };
  if (!isApprovedEmail(doc.email)) return { error: 'user no longer approved' };
  const last = Date.parse(doc.lastUsedAt || 0) || 0;
  if (now().getTime() - last > TOUCH_EVERY_MS) {
    await ds.updateToken(hash, { lastUsedAt: now().toISOString() }).catch(() => {});
  }
  return { uid: doc.uid, email: doc.email, name: doc.name || doc.email, scope: SCOPES.includes(doc.scope) ? doc.scope : 'read', label: doc.label || '', tokenId: hash.slice(0, 12) };
}

/** Public view of a token record for the Settings list (no hash beyond a short id). */
export const tokenView = (doc) => ({
  id: doc.id, label: doc.label || '', scope: doc.scope, createdAt: doc.createdAt,
  lastUsedAt: doc.lastUsedAt || null, revoked: !!doc.revoked, revokedAt: doc.revokedAt || null,
});
