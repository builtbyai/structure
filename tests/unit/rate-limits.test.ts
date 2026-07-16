describe('anthropic/rate-limits', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalAdmin = process.env.ANTHROPIC_ADMIN_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
    process.env.ANTHROPIC_ADMIN_KEY = originalAdmin;
  });

  it('fetchRateLimits hits the rate_limits endpoint', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.ANTHROPIC_ADMIN_KEY;
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ data: [{ type: 'requests_per_minute', limit: 1000 }] }), { status: 200 })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchRateLimits } = require('../../src/anthropic/rate-limits');
    const resp = await fetchRateLimits();
    expect(resp.data).toHaveLength(1);
    expect(resp.data[0].limit).toBe(1000);

    const url = fetchMock.mock.calls[0][0].toString();
    expect(url).toContain('/v1/organizations/rate_limits');
  });

  it('passes workspace_id when provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { fetchRateLimits } = require('../../src/anthropic/rate-limits');
    await fetchRateLimits({ workspaceId: 'ws_42' });
    const url = fetchMock.mock.calls[0][0].toString();
    expect(url).toContain('workspace_id=ws_42');
  });

  it('throws clear error when no key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_ADMIN_KEY;
    const { fetchRateLimits } = require('../../src/anthropic/rate-limits');
    await expect(fetchRateLimits()).rejects.toThrow(/ANTHROPIC_ADMIN_KEY/);
  });
});
