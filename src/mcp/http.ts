/**
 * Streamable HTTP MCP transport (April 2026 spec).
 *
 * Replaces the legacy SSE transport. Optional OAuth 2.1 / PKCE is sketched but
 * not yet wired — bring-your-own-bearer-token is supported via `bearerToken`.
 *
 * See: MCP spec — Streamable HTTP transport.
 */

export interface MCPHttpClientOptions {
  baseUrl: string;
  /** Static bearer token. Tokens from a real OAuth2 PKCE flow can be passed here. */
  bearerToken?: string;
  /** Per-request timeout in ms (default 30s). */
  timeoutMs?: number;
}

export interface MCPCallOptions {
  tool: string;
  args?: Record<string, unknown>;
  /** AbortSignal to cancel the call early. */
  signal?: AbortSignal;
}

export interface MCPCallResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export class MCPHttpClient {
  private baseUrl: string;
  private bearerToken?: string;
  private timeoutMs: number;

  constructor(opts: MCPHttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.bearerToken = opts.bearerToken;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** List available tools on the server. */
  async listTools(): Promise<unknown> {
    return this.request('GET', '/tools', undefined);
  }

  /** Invoke a single tool. */
  async callTool(opts: MCPCallOptions): Promise<MCPCallResult> {
    return this.request('POST', `/tools/${encodeURIComponent(opts.tool)}/call`, {
      args: opts.args ?? {},
    }, opts.signal);
  }

  /**
   * Streaming tool call — returns an async iterator of text chunks.
   * Server is expected to respond with `text/event-stream` framed events.
   */
  async *streamTool(opts: MCPCallOptions): AsyncGenerator<string> {
    const url = `${this.baseUrl}/tools/${encodeURIComponent(opts.tool)}/stream`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ args: opts.args ?? {} }),
      signal: opts.signal ?? AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok || !res.body) {
      throw new Error(`MCP stream ${opts.tool} returned ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Yield complete lines, keep partial line buffered.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          yield trimmed.slice(5).trimStart();
        }
      }
    }
    if (buffer.trim()) yield buffer.trim();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.bearerToken) h.authorization = `Bearer ${this.bearerToken}`;
    return h;
  }

  private async request(
    method: string,
    path: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<MCPCallResult> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ?? AbortSignal.timeout(this.timeoutMs),
    });
    let parsed: unknown = null;
    const text = await res.text();
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { ok: res.ok, status: res.status, body: parsed };
  }
}
