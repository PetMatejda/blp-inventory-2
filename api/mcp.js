// Vercel Function: remote MCP endpoint, Streamable HTTP in stateless mode (POST only).
// Token: personal token from Settings › Přístup pro AI (or the legacy shared spike
// token, read-only) in Authorization: Bearer, X-API-Key, X-BLP-Token or ?key=.
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createBlpMcpServer } from './_lib/mcpServer.js';
import { tokenFromRequest, resolveIdentity } from './_lib/tokens.js';

const jsonRpcError = (res, status, code, message, headers = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
};

/** Factory so tests can inject the data source. `getDs` returns null when not configured. */
export function createMcpHandler({ getDs, env = process.env, now = () => new Date() }) {
  return async function handler(req, res) {
    const ds = await getDs();
    if (!ds && !env.MCP_SPIKE_TOKEN) return jsonRpcError(res, 503, -32000, 'MCP server is not configured.');

    const token = tokenFromRequest(req.headers, req.url);
    let identity;
    try {
      identity = await resolveIdentity(token, { ds, spikeToken: env.MCP_SPIKE_TOKEN || '', now });
    } catch (err) {
      console.error('MCP identity lookup failed', err);
      return jsonRpcError(res, 500, -32603, 'Internal server error');
    }
    if (identity.error) {
      // Never log the token itself – only where it came from and why it was refused.
      const where = ['authorization', 'x-api-key', 'x-blp-token'].filter((h) => req.headers[h]);
      if (/[?&]key=/.test(req.url || '')) where.push('?key');
      console.warn(`MCP auth refused (${identity.error}): ${req.method} ua="${req.headers['user-agent'] || ''}" tokenIn=[${where.join(',')}]`);
      // 403, not 401: a 401 makes MCP clients (Claude connectors) start OAuth discovery,
      // which this server does not offer (personal tokens only).
      return jsonRpcError(res, 403, -32001, 'Missing or invalid token. Create a personal token in BLP Inventory › Nastavení › Přístup pro AI.');
    }
    if (req.method !== 'POST') return jsonRpcError(res, 405, -32000, 'Method not allowed.', { Allow: 'POST' });
    if (!ds) return jsonRpcError(res, 503, -32000, 'Database access is not configured (FIREBASE_SERVICE_ACCOUNT).');

    const server = createBlpMcpServer({ identity, ds, now });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP request failed', err);
      if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    }
  };
}

let firestoreDs;
async function productionDs() {
  if (firestoreDs !== undefined) return firestoreDs;
  const { adminDb, isAdminConfigured } = await import('./_lib/firestoreAdmin.js');
  if (!isAdminConfigured()) { firestoreDs = null; return null; }
  const { createFirestoreDataSource } = await import('./_lib/dataSource.js');
  firestoreDs = createFirestoreDataSource(adminDb());
  return firestoreDs;
}

const handler = createMcpHandler({ getDs: productionDs });
export default handler;
