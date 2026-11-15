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

const connect = async (token = TOKEN, headerName = 'Authorization') => {
  const client = new Client({ name: 'test', version: '1.0.0' });
  const value = headerName === 'Authorization' ? `Bearer ${token}` : token;
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { [headerName]: value } },
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

  it.each(['X-API-Key', 'X-BLP-Token'])('accepts the token in %s (Claude custom connectors)', async (header) => {
    const client = await connect(TOKEN, header);
    const result = await client.callTool({ name: 'ping', arguments: {} });
    expect(result.content[0].text).toMatch(/^pong/);
    await client.close();
  });

  it('refuses a wrong token', async () => {
    await expect(connect('wrong')).rejects.toThrow();
    await expect(connect('wrong', 'X-BLP-Token')).rejects.toThrow();
  });

  it('accepts the token as ?key= in the URL (secret URL for connectors without headers)', async () => {
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url}?key=${TOKEN}`)));
    const result = await client.callTool({ name: 'ping', arguments: {} });
    expect(result.content[0].text).toMatch(/^pong/);
    await client.close();

    const wrong = await fetch(`${url}?key=wrong`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(wrong.status).toBe(403);
  });

  it('refuses requests without a token and non-POST methods', async () => {
    const noAuth = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(noAuth.status).toBe(403);
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
  const auth = (v) => ({ authorization: v });
  const custom = (v) => ({ 'x-blp-token': v });

  it('accepts only the exact bearer token', () => {
    expect(isAuthorized(auth(`Bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(isAuthorized(auth(`bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(isAuthorized(auth(`Bearer ${TOKEN}x`), TOKEN)).toBe(false);
    expect(isAuthorized(auth(TOKEN), TOKEN)).toBe(false);
    expect(isAuthorized(auth(`Bearer ${TOKEN}`), '')).toBe(false);
    expect(isAuthorized({}, TOKEN)).toBe(false);
    expect(isAuthorized(undefined, TOKEN)).toBe(false);
  });

  it('accepts the exact token in X-BLP-Token, with or without "Bearer "', () => {
    expect(isAuthorized(custom(TOKEN), TOKEN)).toBe(true);
    expect(isAuthorized(custom(` ${TOKEN} `), TOKEN)).toBe(true);
    expect(isAuthorized(custom(`Bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(isAuthorized(custom(`${TOKEN}x`), TOKEN)).toBe(false);
    expect(isAuthorized(custom(''), TOKEN)).toBe(false);
    expect(isAuthorized({ ...auth('Bearer wrong'), ...custom(TOKEN) }, TOKEN)).toBe(true);
  });

  it('accepts the exact token in X-API-Key', () => {
    expect(isAuthorized({ 'x-api-key': TOKEN }, TOKEN)).toBe(true);
    expect(isAuthorized({ 'x-api-key': `${TOKEN}x` }, TOKEN)).toBe(false);
    expect(isAuthorized({ 'x-api-key': '' }, TOKEN)).toBe(false);
  });
});
