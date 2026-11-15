// Vercel Function: remote MCP endpoint, Streamable HTTP in stateless mode.
//   POST /api/mcp   JSON-RPC (MCP)          Authorization: Bearer <MCP_SPIKE_TOKEN>
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

/** Constant-time comparison of the bearer token with the configured one. */
export function isAuthorized(authHeader, expected) {
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(String(authHeader || ''));
  if (!match) return false;
  const a = Buffer.from(match[1].trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  const expected = process.env.MCP_SPIKE_TOKEN;
  if (!expected) return jsonRpcError(res, 503, -32000, 'MCP server is not configured (MCP_SPIKE_TOKEN missing).');
  if (!isAuthorized(req.headers.authorization, expected)) {
    return jsonRpcError(res, 401, -32001, 'Unauthorized', { 'WWW-Authenticate': 'Bearer realm="blp-inventory"' });
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
