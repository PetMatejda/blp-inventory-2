// Vercel Function: remote MCP endpoint, Streamable HTTP in stateless mode.
//   POST /api/mcp   JSON-RPC (MCP)   Authorization: Bearer <MCP_SPIKE_TOKEN>  or  X-API-Key: <MCP_SPIKE_TOKEN>
// Spike only (docs/MCP_SERVER_PLAN.md, phase 0). Personal tokens / OAuth come later.
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createBlpMcpServer } from './_lib/mcpServer.js';

const jsonRpcError = (res, status, code, message, headers = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
};

const sameToken = (given, expected) => {
  const a = Buffer.from(String(given).trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

// Header names that may carry the token besides Authorization. Claude custom connectors
// (claude.ai, Cowork) reserve Authorization for OAuth and only allow approved names —
// `x-api-key` is one of the standard ones.
const TOKEN_HEADERS = ['x-api-key', 'x-blp-token'];

/**
 * Token check (constant time). Accepts `Authorization: Bearer <token>` (Claude Code,
 * Antigravity) or the token in `X-API-Key` / `X-BLP-Token` (Claude custom connectors).
 */
export function isAuthorized(headers, expected) {
  if (!expected) return false;
  const bearer = /^Bearer\s+(.+)$/i.exec(String(headers?.authorization || ''));
  if (bearer && sameToken(bearer[1], expected)) return true;
  return TOKEN_HEADERS.some((name) => {
    const value = headers?.[name];
    return typeof value === 'string' && value.length > 0 && sameToken(value.replace(/^Bearer\s+/i, ''), expected);
  });
}

/**
 * Token in the URL (`/api/mcp?key=<token>`). Fallback for Claude custom connectors
 * (Cowork, claude.ai) when request headers are not sent – a "secret URL". Weaker than a
 * header (the URL can end up in logs/history), acceptable for the spike only; phase C
 * replaces it with OAuth.
 */
export function keyFromUrl(url) {
  try { return new URL(url || '', 'http://localhost').searchParams.get('key') || ''; } catch { return ''; }
}

export default async function handler(req, res) {
  const expected = process.env.MCP_SPIKE_TOKEN;
  if (!expected) return jsonRpcError(res, 503, -32000, 'MCP server is not configured (MCP_SPIKE_TOKEN missing).');
  const urlKey = keyFromUrl(req.url);
  if (!isAuthorized(req.headers, expected) && !(urlKey && sameToken(urlKey, expected))) {
    // Header names only (never values) – shows in Vercel logs whether a client sent a token at all.
    const sent = ['authorization', ...TOKEN_HEADERS].filter((h) => req.headers[h]);
    if (urlKey) sent.push('?key');
    console.warn(`MCP auth refused: ${req.method} ua="${req.headers['user-agent'] || ''}" tokenHeaders=[${sent.join(',')}]`);
    // 403, not 401: a 401 makes MCP clients (Claude connectors) start OAuth discovery and
    // dynamic client registration, which this server does not offer (static token only).
    return jsonRpcError(res, 403, -32001, 'Missing or invalid token. Send X-API-Key: <token> or Authorization: Bearer <token>.');
  }
  // Stateless: no server-initiated SSE stream (GET) and no sessions to delete (DELETE).
  if (req.method !== 'POST') return jsonRpcError(res, 405, -32000, 'Method not allowed.', { Allow: 'POST' });

  const server = createBlpMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request failed', err);
    if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
  }
}
