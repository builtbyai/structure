/**
 * `structure usage` — report on token / cost / cache-hit usage.
 *
 * Mirrors Claude Code's merged /usage view. Reads ~/.structure/usage.log.
 */

import { Command } from 'commander';
import { readUsage, summarize, ledgerPath } from '../../usage/ledger.js';

export function usageCommands(program: Command): void {
  program
    .command('usage')
    .description('Report on Claude API token usage, cost, and cache hit rate')
    .option('--json', 'Output as JSON')
    .option('--last <n>', 'Only summarize the last N calls', (v) => parseInt(v, 10))
    .option('--records', 'Print individual records instead of a summary')
    .action(async (options: { json?: boolean; last?: number; records?: boolean }) => {
      const records = await readUsage(options.last);

      if (options.records) {
        if (options.json) {
          console.log(JSON.stringify(records, null, 2));
        } else {
          for (const r of records) {
            console.log(
              `${r.timestamp}  ${r.model.padEnd(28)}  in=${r.inputTokens}  out=${r.outputTokens}  cache_read=${r.cacheReadInputTokens ?? 0}  $${r.costUsd.toFixed(4)}`
            );
          }
        }
        return;
      }

      const sum = summarize(records);

      if (options.json) {
        console.log(JSON.stringify(sum, null, 2));
        return;
      }

      console.log(`\nUsage summary  (ledger: ${ledgerPath()})\n`);
      if (sum.totalCalls === 0) {
        console.log('  No usage recorded yet.');
        return;
      }
      console.log(`  Calls            : ${sum.totalCalls}`);
      console.log(`  Total cost       : $${sum.totalCostUsd.toFixed(4)}`);
      console.log(`  Input tokens     : ${sum.totalInputTokens.toLocaleString()}`);
      console.log(`  Output tokens    : ${sum.totalOutputTokens.toLocaleString()}`);
      console.log(`  Cache reads      : ${sum.totalCacheReads.toLocaleString()}`);
      console.log(`  Cache writes     : ${sum.totalCacheWrites.toLocaleString()}`);
      console.log(`  Cache hit rate   : ${(sum.cacheHitRate * 100).toFixed(1)}%`);

      console.log('\n  By model:');
      for (const [model, stats] of Object.entries(sum.byModel)) {
        console.log(`    ${model.padEnd(30)}  ${stats.calls} calls   $${stats.costUsd.toFixed(4)}`);
      }
      console.log('\n  By provider:');
      for (const [provider, stats] of Object.entries(sum.byProvider)) {
        console.log(`    ${provider.padEnd(30)}  ${stats.calls} calls   $${stats.costUsd.toFixed(4)}`);
      }
      console.log('');
    });
}
