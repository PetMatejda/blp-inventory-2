// Runs the Vercel MCP function locally without the Vercel CLI (it mimics the
// Node runtime: JSON body parsed into req.body).
//   MCP_SPIKE_TOKEN=dev-token node scripts/mcp-local.mjs   → http://localhost:3333/api/mcp
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import handler from '../api/mcp.js';

export function createLocalMcpServer() {
  return http.createServer((req, res) => {
    if (!req.url.startsWith('/api/mcp')) { res.statusCode = 404; res.end('Not found'); return; }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
      handler(req, res);
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3333;
  if (!process.env.MCP_SPIKE_TOKEN) console.warn('MCP_SPIKE_TOKEN is not set – every request will get 503.');
  createLocalMcpServer().listen(port, () => console.log(`BLP MCP server: http://localhost:${port}/api/mcp`));
}
