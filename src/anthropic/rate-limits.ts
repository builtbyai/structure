/**
 * Anthropic Rate Limits API client (2026-Q1).
 *
 * Programmatic introspection of org/workspace rate limits.
 * Endpoint: GET https://api.anthropic.com/v1/organizations/rate_limits
 */

const API_URL = 'https://api.anthropic.com/v1/organizations/rate_limits';
const ANTHROPIC_VERSION = '2023-06-01';

export interface RateLimit {
  type: string;
  limit: number;
  used?: number;
  remaining?: number;
  reset?: string;
  workspace_id?: string;
}

export interface RateLimitsResponse {
  data: RateLimit[];
  has_more?: boolean;
}

export async function fetchRateLimits(opts: { workspaceId?: string } = {}): Promise<RateLimitsResponse> {
  const apiKey = process.env.ANTHROPIC_ADMIN_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_ADMIN_KEY (or ANTHROPIC_API_KEY) is not set');
  }

  const url = new URL(API_URL);
  if (opts.workspaceId) url.searchParams.set('workspace_id', opts.workspaceId);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rate Limits API ${res.status}: ${text}`);
  }
  return res.json() as Promise<RateLimitsResponse>;
}
