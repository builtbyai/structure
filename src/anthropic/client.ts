/**
 * Direct Anthropic API client with prompt caching + usage logging.
 *
 * Use this when you want billed-by-token-count cache benefits, instead of
 * spawning the `claude` CLI. Writes one record per call to the usage ledger.
 *
 * Requires ANTHROPIC_API_KEY (or whatever apiKeyEnv resolves to).
 */

import {
  ANTHROPIC_MODELS,
  resolveAnthropicModelId,
  type ModelDescriptor,
} from '../config/providers.js';
import { buildCachedSystem, estimateCost, type CacheTTL, type CacheUsage } from './cache.js';
import { appendUsage } from '../usage/ledger.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface CompleteOptions {
  modelTierOrId: string;
  system: string;
  skillBlock?: string;
  user: string;
  maxTokens?: number;
  ttl?: CacheTTL;
  source?: string;
}

export interface CompleteResult {
  text: string;
  model: string;
  usage: CacheUsage;
  costUsd: number;
}

export interface ImageInput {
  /** Base64-encoded image data (no data: prefix). */
  data: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface CompleteWithImagesOptions {
  modelTierOrId: string;
  system: string;
  userText: string;
  images: ImageInput[];
  maxTokens?: number;
  ttl?: CacheTTL;
  source?: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * One-shot, non-streaming completion with system + skill block both cached.
 * The user message is NOT cached (it varies per call).
 */
export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const modelId = resolveAnthropicModelId(opts.modelTierOrId);
  const descriptor: ModelDescriptor | undefined = ANTHROPIC_MODELS[modelId];
  if (!descriptor) {
    throw new Error(`Unknown Anthropic model: ${modelId}`);
  }

  const ttl = opts.ttl ?? '5m';
  const start = Date.now();

  const body = {
    model: modelId,
    max_tokens: opts.maxTokens ?? 4096,
    system: buildCachedSystem({
      system: opts.system,
      skillBlock: opts.skillBlock,
      ttl,
    }),
    messages: [{ role: 'user', content: opts.user }],
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  const usage: CacheUsage = {
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    cacheCreationInputTokens: data.usage.cache_creation_input_tokens,
    cacheReadInputTokens: data.usage.cache_read_input_tokens,
  };
  const costUsd = estimateCost(descriptor, usage, ttl);

  await appendUsage({
    timestamp: new Date().toISOString(),
    provider: 'anthropic',
    model: modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    costUsd,
    source: opts.source,
    durationMs: Date.now() - start,
  });

  return { text, model: modelId, usage, costUsd };
}

/**
 * Vision-capable completion. Sends images alongside a text prompt to a
 * vision-capable model (Opus 4.7 supports up to 3.75MP / 2576px).
 */
export async function completeWithImages(
  opts: CompleteWithImagesOptions
): Promise<CompleteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const modelId = resolveAnthropicModelId(opts.modelTierOrId);
  const descriptor = ANTHROPIC_MODELS[modelId];
  if (!descriptor) throw new Error(`Unknown Anthropic model: ${modelId}`);
  if (!descriptor.supportsVision) {
    throw new Error(`Model ${modelId} does not support vision input`);
  }
  const ttl = opts.ttl ?? '5m';
  const start = Date.now();

  const userContent: Array<Record<string, unknown>> = opts.images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.data },
  }));
  if (opts.userText) {
    userContent.push({ type: 'text', text: opts.userText });
  }

  const body = {
    model: modelId,
    max_tokens: opts.maxTokens ?? 4096,
    system: buildCachedSystem({ system: opts.system, ttl }),
    messages: [{ role: 'user', content: userContent }],
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as AnthropicResponse;
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  const usage: CacheUsage = {
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    cacheCreationInputTokens: data.usage.cache_creation_input_tokens,
    cacheReadInputTokens: data.usage.cache_read_input_tokens,
  };
  const costUsd = estimateCost(descriptor, usage, ttl);

  await appendUsage({
    timestamp: new Date().toISOString(),
    provider: 'anthropic',
    model: modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    costUsd,
    source: opts.source ?? 'vision',
    durationMs: Date.now() - start,
  });

  return { text, model: modelId, usage, costUsd };
}
