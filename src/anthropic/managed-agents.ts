/**
 * Anthropic Managed Agents (public beta, header: managed-agents-2026-04-01).
 *
 * A hosted agent harness — submit a job, poll/stream results. Memory is in
 * public beta under the same beta header.
 *
 * This is a thin adapter; the full Managed Agents schema is still beta and
 * may evolve. Coverage here: createAgentRun(), getAgentRun(), streamEvents().
 */

const API_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const BETA_HEADER = 'managed-agents-2026-04-01';

export interface AgentRunRequest {
  model: string;
  task: string;
  tools?: Array<{ name: string; type?: string; [k: string]: unknown }>;
  memory?: { enabled?: boolean; namespace?: string };
  /** Optional metadata recorded with the run. */
  metadata?: Record<string, string>;
}

export interface AgentRunResponse {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  result?: { output: string; usage?: Record<string, number> };
  error?: { type: string; message: string };
  created_at?: string;
  completed_at?: string;
}

function authHeaders(): Record<string, string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-beta': BETA_HEADER,
    'content-type': 'application/json',
  };
}

/** Submit a new managed agent run. Returns immediately with the run id. */
export async function createAgentRun(req: AgentRunRequest): Promise<AgentRunResponse> {
  const res = await fetch(`${API_BASE}/agents/runs`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`createAgentRun ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<AgentRunResponse>;
}

/** Poll a single run by id. */
export async function getAgentRun(id: string): Promise<AgentRunResponse> {
  const res = await fetch(`${API_BASE}/agents/runs/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`getAgentRun ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<AgentRunResponse>;
}

/** Wait for a run to leave queued/running. Polls every `intervalMs`. */
export async function waitForAgentRun(
  id: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<AgentRunResponse> {
  const interval = opts.intervalMs ?? 2_000;
  const timeout = opts.timeoutMs ?? 5 * 60_000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const run = await getAgentRun(id);
    if (run.status !== 'queued' && run.status !== 'running') {
      return run;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Agent run ${id} timed out after ${timeout}ms`);
}

/**
 * Stream Server-Sent Events from a run. Yields the `data:` payload of each event.
 * Caller is responsible for parsing JSON.
 */
export async function* streamAgentEvents(id: string): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/agents/runs/${encodeURIComponent(id)}/events`, {
    method: 'GET',
    headers: { ...authHeaders(), accept: 'text/event-stream' },
  });
  if (!res.ok || !res.body) {
    throw new Error(`streamAgentEvents ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
