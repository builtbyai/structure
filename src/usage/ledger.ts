/**
 * Usage ledger — append-only JSONL log of provider calls.
 *
 * Stored at ~/.structure/usage.log. Each line is a single JSON record with
 * tokens, cache hits, and estimated USD cost. The `structure usage` command
 * reads and aggregates this file.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface UsageRecord {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  costUsd: number;
  source?: string;
  durationMs?: number;
}

export function ledgerPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, '.structure', 'usage.log');
}

export async function appendUsage(record: UsageRecord): Promise<void> {
  const file = ledgerPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(record) + '\n', 'utf-8');
}

export async function readUsage(limit?: number): Promise<UsageRecord[]> {
  const file = ledgerPath();
  let content: string;
  try {
    content = await fs.readFile(file, 'utf-8');
  } catch {
    return [];
  }
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const records: UsageRecord[] = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // skip malformed line
    }
  }
  return typeof limit === 'number' ? records.slice(-limit) : records;
}

export interface UsageSummary {
  totalCalls: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReads: number;
  totalCacheWrites: number;
  cacheHitRate: number;
  byModel: Record<string, { calls: number; costUsd: number }>;
  byProvider: Record<string, { calls: number; costUsd: number }>;
}

export function summarize(records: UsageRecord[]): UsageSummary {
  const summary: UsageSummary = {
    totalCalls: records.length,
    totalCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReads: 0,
    totalCacheWrites: 0,
    cacheHitRate: 0,
    byModel: {},
    byProvider: {},
  };

  for (const r of records) {
    summary.totalCostUsd += r.costUsd;
    summary.totalInputTokens += r.inputTokens;
    summary.totalOutputTokens += r.outputTokens;
    summary.totalCacheReads += r.cacheReadInputTokens ?? 0;
    summary.totalCacheWrites += r.cacheCreationInputTokens ?? 0;

    summary.byModel[r.model] ??= { calls: 0, costUsd: 0 };
    summary.byModel[r.model].calls += 1;
    summary.byModel[r.model].costUsd += r.costUsd;

    summary.byProvider[r.provider] ??= { calls: 0, costUsd: 0 };
    summary.byProvider[r.provider].calls += 1;
    summary.byProvider[r.provider].costUsd += r.costUsd;
  }

  const totalIn =
    summary.totalInputTokens + summary.totalCacheReads + summary.totalCacheWrites;
  summary.cacheHitRate = totalIn > 0 ? summary.totalCacheReads / totalIn : 0;
  return summary;
}
