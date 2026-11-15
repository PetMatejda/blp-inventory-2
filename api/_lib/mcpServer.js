// BLP Inventory MCP server (spike, phase 0 of docs/MCP_SERVER_PLAN.md).
// Only a `ping` tool for now: it proves that remote MCP clients (Claude Code,
// Claude Desktop, Antigravity) can reach the server on Vercel. No database access.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const SERVER_INFO = { name: 'blp-inventory', version: '0.1.0' };

/** A fresh server per request (stateless Streamable HTTP on serverless functions). */
export function createBlpMcpServer({ now = () => new Date() } = {}) {
  const server = new McpServer(SERVER_INFO, {
    instructions: 'BLP Inventory – film lighting & grip gear inventory (Balloon Light Praha). '
      + 'Spike version: only the ping tool is available.',
  });

  server.registerTool('ping', {
    title: 'Ping',
    description: 'Checks the connection to the BLP Inventory MCP server. Returns "pong", the server time and version.',
    inputSchema: { message: z.string().max(200).optional().describe('Optional text echoed back') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ message }) => {
    const text = [
      'pong',
      `server: ${SERVER_INFO.name} ${SERVER_INFO.version}`,
      `time: ${now().toISOString()}`,
      message ? `echo: ${message}` : null,
    ].filter(Boolean).join('\n');
    return { content: [{ type: 'text', text }] };
  });

  return server;
}
