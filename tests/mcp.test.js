// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLocalMcpServer } from '../scripts/mcp-local.mjs';
import { isAuthorized } from '../api/mcp.js';

const TOKEN = 'test-token-123';
let httpServer;
let url;

beforeAll(async () => {
  process.env.MCP_SPIKE_TOKEN = TOKEN;
  httpServer = createLocalMcpServer();
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${httpServer.address().port}/api/mcp`;
});

afterAll(async () => {
  delete process.env.MCP_SPIKE_TOKEN;
  await new Promise((resolve) => httpServer.close(resolve));
});

const connect = async (token = TOKEN) => {
  const client = new Client({ name: 'test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
};

describe('MCP spike endpoint', () => {
  it('lists the ping tool and answers it', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['ping']);
    expect(tools[0].annotations?.readOnlyHint).toBe(true);

    const result = await client.callTool({ name: 'ping', arguments: { message: 'ahoj' } });
    const text = result.content[0].text;
    expect(text).toMatch(/^pong/);
    expect(text).toContain('echo: ahoj');
    await client.close();
  });

  it('refuses a wrong token', async () => {
    await expect(connect('wrong')).rejects.toThrow();
  });

  it('refuses requests without a token and non-POST methods', async () => {
    const noAuth = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(noAuth.status).toBe(401);
    const get = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(get.status).toBe(405);
  });

  it('answers 503 when the server has no token configured', async () => {
    delete process.env.MCP_SPIKE_TOKEN;
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: '{}' });
    expect(r.status).toBe(503);
    process.env.MCP_SPIKE_TOKEN = TOKEN;
  });
});

describe('isAuthorized', () => {
  it('accepts only the exact bearer token', () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isAuthorized(`bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isAuthorized(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(isAuthorized(TOKEN, TOKEN)).toBe(false);
    expect(isAuthorized(`Bearer ${TOKEN}`, '')).toBe(false);
    expect(isAuthorized(undefined, TOKEN)).toBe(false);
  });
});
