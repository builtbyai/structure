/**
 * MCP HTTP client tests — uses a mocked global fetch.
 */

import { MCPHttpClient } from '../../src/mcp/http';

describe('MCPHttpClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('listTools issues GET and parses JSON', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ tools: ['a', 'b'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const client = new MCPHttpClient({ baseUrl: 'http://example.test/' });
    const result = await client.listTools();
    expect(result).toMatchObject({ ok: true, status: 200, body: { tools: ['a', 'b'] } });

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('http://example.test/tools');
    expect(call[1].method).toBe('GET');
  });

  it('callTool POSTs args + bearer token', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ ok: true, result: 42 }), { status: 200 })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MCPHttpClient({
      baseUrl: 'http://example.test',
      bearerToken: 'secret',
    });
    const r = await client.callTool({ tool: 'echo', args: { x: 1 } });
    expect(r.ok).toBe(true);
    expect(r.body).toMatchObject({ ok: true, result: 42 });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.authorization).toBe('Bearer secret');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ args: { x: 1 } });
  });

  it('returns ok=false on non-2xx without throwing', async () => {
    global.fetch = jest.fn(async () =>
      new Response('boom', { status: 500 })
    ) as unknown as typeof fetch;
    const client = new MCPHttpClient({ baseUrl: 'http://example.test' });
    const r = await client.callTool({ tool: 'broken' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
  });
});
