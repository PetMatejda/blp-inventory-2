// Vercel Function: personal MCP tokens of the signed-in user (Settings › Přístup pro AI).
//   GET    /api/mcp-tokens            → { tokens: [...] }   own tokens
//   POST   /api/mcp-tokens            { label, scope }      → { token, record }  (token shown once)
//   DELETE /api/mcp-tokens?id=<id>    → { record }          revoke own token
// Auth: Authorization: Bearer <Firebase ID token> of a verified, approved user.
import { isApprovedEmail } from './_lib/approvedEmails.js';
import { generateToken, hashToken, tokenView, SCOPES } from './_lib/tokens.js';

const MAX_ACTIVE_TOKENS = 10;

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

/** Factory so tests can inject the data source and the ID-token verifier. */
export function createTokensHandler({ getDs, verifyIdToken, now = () => new Date() }) {
  return async function handler(req, res) {
    const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
    if (!m) return send(res, 401, { error: 'Chybí přihlášení.' });
    let user;
    try { user = await verifyIdToken(m[1].trim()); } catch { return send(res, 401, { error: 'Neplatné přihlášení.' }); }
    if (!user?.email_verified || !isApprovedEmail(user.email)) return send(res, 403, { error: 'Účet nemá přístup.' });

    const ds = getDs();
    try {
      if (req.method === 'GET') {
        const tokens = (await ds.listTokens(user.uid)).map(tokenView)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return send(res, 200, { tokens });
      }
      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const label = String(body.label || '').trim().slice(0, 60) || 'AI klient';
        const scope = SCOPES.includes(body.scope) ? body.scope : 'read';
        const active = (await ds.listTokens(user.uid)).filter((t) => !t.revoked);
        if (active.length >= MAX_ACTIVE_TOKENS) return send(res, 400, { error: `Máte už ${MAX_ACTIVE_TOKENS} aktivních tokenů – nějaký zrušte.` });
        const profile = await ds.getUserProfile(user.uid).catch(() => null);
        const token = generateToken();
        const hash = hashToken(token);
        const record = {
          uid: user.uid, email: String(user.email).toLowerCase(), name: profile?.name || user.name || user.email,
          label, scope, createdAt: now().toISOString(), lastUsedAt: null, revoked: false,
        };
        await ds.createToken(hash, record);
        return send(res, 201, { token, record: tokenView({ ...record, id: hash }) });
      }
      if (req.method === 'DELETE') {
        const id = new URL(req.url || '', 'http://localhost').searchParams.get('id') || '';
        const doc = id ? await ds.getToken(id) : null;
        if (!doc || doc.uid !== user.uid) return send(res, 404, { error: 'Token nenalezen.' });
        const patch = { revoked: true, revokedAt: now().toISOString() };
        await ds.updateToken(id, patch);
        return send(res, 200, { record: tokenView({ ...doc, ...patch, id }) });
      }
      res.setHeader('Allow', 'GET, POST, DELETE');
      return send(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      console.error('mcp-tokens failed', err);
      return send(res, 500, { error: 'Chyba serveru.' });
    }
  };
}

let handler;
export default async function mcpTokens(req, res) {
  if (!handler) {
    const { adminDb, adminAuth, isAdminConfigured } = await import('./_lib/firestoreAdmin.js');
    if (!isAdminConfigured()) return send(res, 503, { error: 'Server nemá nastavený přístup k databázi.' });
    const { createFirestoreDataSource } = await import('./_lib/dataSource.js');
    const ds = createFirestoreDataSource(adminDb());
    handler = createTokensHandler({ getDs: () => ds, verifyIdToken: (t) => adminAuth().verifyIdToken(t) });
  }
  return handler(req, res);
}

// Exported for tests (hash of a token = record id).
export { hashToken };
