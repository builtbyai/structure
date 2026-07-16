/**
 * Tests for the direct Anthropic API client + vision wrapper + managed agents.
 * fetch is mocked; we verify the cache_control markers, beta headers, and
 * usage-ledger writes.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('anthropic/client', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'structure-anthropic-'));
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('complete() sends cache_control markers + records usage', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'hello back' }],
          model: 'claude-opus-4-7',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 0,
          },
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { complete } = require('../../src/anthropic/client');
    const r = await complete({
      modelTierOrId: 'advanced',
      system: 'sys',
      skillBlock: 'skill',
      user: 'hi',
    });

    expect(r.text).toBe('hello back');
    expect(r.model).toBe('claude-opus-4-7');
    expect(r.usage.cacheReadInputTokens).toBe(1000);
    // Cost = base in (10) + cache read (1000 × 0.1) at $5/M + output 5 at $25/M
    expect(r.costUsd).toBeGreaterThan(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '5m' });
    expect(body.system[1].text).toBe('skill');

    const { readUsage } = require('../../src/usage/ledger');
    const records = await readUsage();
    expect(records).toHaveLength(1);
    expect(records[0].model).toBe('claude-opus-4-7');
    expect(records[0].source).toBeUndefined();
  });

  it('throws when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { complete } = require('../../src/anthropic/client');
    await expect(complete({
      modelTierOrId: 'advanced',
      system: 's',
      user: 'u',
    })).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('completeWithImages() sends image blocks + text', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'a button' }],
          model: 'claude-opus-4-7',
          usage: { input_tokens: 50, output_tokens: 10 },
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { completeWithImages } = require('../../src/anthropic/client');
    const r = await completeWithImages({
      modelTierOrId: 'advanced',
      system: 'visual',
      userText: 'what is this?',
      images: [{ data: 'AAAA', mediaType: 'image/png' }],
    });
    expect(r.text).toBe('a button');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userContent = body.messages[0].content;
    expect(userContent[0].type).toBe('image');
    expect(userContent[0].source.media_type).toBe('image/png');
    expect(userContent[1].type).toBe('text');
  });
});

describe('anthropic/managed-agents', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('createAgentRun sends managed-agents-2026-04-01 beta header', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ id: 'run_1', status: 'queued' }), { status: 200 })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { createAgentRun } = require('../../src/anthropic/managed-agents');
    const run = await createAgentRun({ model: 'claude-opus-4-7', task: 'do x' });
    expect(run.id).toBe('run_1');

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01');
    expect(headers['x-api-key']).toBe('test-key');
  });
});
