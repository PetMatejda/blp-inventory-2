// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTokensHandler } from '../api/mcp-tokens.js';
import { hashToken, resolveIdentity } from '../api/_lib/tokens.js';
import { createMemoryDataSource } from './memoryDataSource.js';

const USERS = {
  'id-petr': { uid: 'u1', email: 'petmatejda@gmail.com', email_verified: true, name: 'Petr G' },
  'id-unverified': { uid: 'u2', email: 'marekradolf@seznam.cz', email_verified: false },
  'id-stranger': { uid: 'u3', email: 'x@y.cz', email_verified: true },
  'id-marek': { uid: 'u4', email: 'marekradolf@seznam.cz', email_verified: true },
};

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (b) => { res.body = b ? JSON.parse(b) : null; };
  return res;
}

let ds;
let handler;
const request = async (method, idToken, { body, url = '/api/mcp-tokens' } = {}) => {
  const res = fakeRes();
  await handler({ method, url, body, headers: idToken ? { authorization: `Bearer ${idToken}` } : {} }, res);
  return res;
};

beforeEach(() => {
  ds = createMemoryDataSource({ users: [{ id: 'u1', name: 'Petr Matějíček' }] });
  handler = createTokensHandler({
    getDs: () => ds,
    verifyIdToken: async (t) => { if (!USERS[t]) throw new Error('bad'); return USERS[t]; },
    now: () => new Date('2026-11-15T10:00:00Z'),
  });
});

describe('/api/mcp-tokens', () => {
  it('requires a verified, approved Firebase user', async () => {
    expect((await request('GET')).statusCode).toBe(401);
    expect((await request('GET', 'id-bogus')).statusCode).toBe(401);
    expect((await request('GET', 'id-unverified')).statusCode).toBe(403);
    expect((await request('GET', 'id-stranger')).statusCode).toBe(403);
  });

  it('creates a token shown once; only its hash is stored', async () => {
    const r = await request('POST', 'id-petr', { body: { label: 'Cowork', scope: 'write' } });
    expect(r.statusCode).toBe(201);
    expect(r.body.token).toMatch(/^blp_mcp_[A-Za-z0-9_-]{43}$/);
    const stored = ds.mem.all('mcpTokens');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(hashToken(r.body.token));
    expect(JSON.stringify(stored)).not.toContain(r.body.token);
    expect(stored[0]).toMatchObject({ uid: 'u1', name: 'Petr Matějíček', scope: 'write', label: 'Cowork' });

    const identity = await resolveIdentity(r.body.token, { ds });
    expect(identity).toMatchObject({ uid: 'u1', scope: 'write', name: 'Petr Matějíček' });
  });

  it('defaults to read scope and lists only own tokens', async () => {
    await request('POST', 'id-petr', { body: { label: 'A', scope: 'admin' } });
    await request('POST', 'id-marek', { body: { label: 'B' } });
    const mine = await request('GET', 'id-petr');
    expect(mine.body.tokens.map((t) => [t.label, t.scope])).toEqual([['A', 'read']]);
  });

  it('revokes own tokens only; a revoked token stops working', async () => {
    const created = await request('POST', 'id-petr', { body: { label: 'A' } });
    const id = created.body.record.id;
    expect((await request('DELETE', 'id-marek', { url: `/api/mcp-tokens?id=${id}` })).statusCode).toBe(404);
    const r = await request('DELETE', 'id-petr', { url: `/api/mcp-tokens?id=${id}` });
    expect(r.body.record.revoked).toBe(true);
    expect((await resolveIdentity(created.body.token, { ds })).error).toBe('revoked token');
  });
});
