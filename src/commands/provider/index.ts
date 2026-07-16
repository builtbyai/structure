/**
 * Provider Commands
 *
 * Manage AI providers (Anthropic, OpenAI/Codex, Ollama) and their MCP integrations.
 * Commands: provider list, provider use, provider status, provider models
 */

import { Command } from 'commander';
import {
  PROVIDERS,
  ProviderName,
  getProvider,
  isProviderAvailable,
  listProviders,
  resolveModel,
} from '../../config/providers.js';
import { OllamaMCP } from '../../mcp/ollama.js';
import { OllamaFleet } from '../../mcp/ollama-fleet.js';
import { CodexMCP } from '../../mcp/codex.js';
import { fetchRateLimits } from '../../anthropic/rate-limits.js';

export function providerCommands(program: Command): void {
  const provider = program
    .command('provider')
    .description('Manage AI providers (anthropic, openai, ollama)');

  // Rate limits (Anthropic only — uses Rate Limits API)
  provider
    .command('limits')
    .description('Show Anthropic org/workspace rate limits')
    .option('--workspace <id>', 'Restrict to a specific workspace')
    .option('--json', 'Output as JSON')
    .action(async (options: { workspace?: string; json?: boolean }) => {
      try {
        const resp = await fetchRateLimits({ workspaceId: options.workspace });
        if (options.json) {
          console.log(JSON.stringify(resp, null, 2));
          return;
        }
        if (!resp.data?.length) {
          console.log('No rate limits returned.');
          return;
        }
        console.log('\nAnthropic Rate Limits:\n');
        for (const r of resp.data) {
          const used = r.used ?? '?';
          const remaining = r.remaining ?? '?';
          const ws = r.workspace_id ? ` [${r.workspace_id}]` : '';
          console.log(`  ${r.type.padEnd(28)} limit=${r.limit}  used=${used}  remaining=${remaining}${ws}`);
        }
        console.log('');
      } catch (err) {
        console.error('Failed to fetch rate limits:', (err as Error).message);
        process.exitCode = 1;
      }
    });

  // List all providers and their status
  provider
    .command('list')
    .alias('ls')
    .description('List all available providers and their status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const providers = await listProviders();

      if (options.json) {
        console.log(JSON.stringify(providers, null, 2));
        return;
      }

      console.log('\nAI Providers:\n');
      for (const p of providers) {
        const status = p.available ? '\x1b[32m● available\x1b[0m' : '\x1b[31m○ not found\x1b[0m';
        console.log(`  ${p.name.padEnd(12)} ${status}`);
        console.log(`    CLI: ${p.cli}${p.apiBase ? `  API: ${p.apiBase}` : ''}`);
        console.log(`    Models: fast=${p.models.fast}, standard=${p.models.standard}, advanced=${p.models.advanced}`);
        console.log();
      }
    });

  // Switch active provider
  provider
    .command('use <name>')
    .description('Set the active AI provider (anthropic, openai, ollama)')
    .action(async (name: string) => {
      const validNames: ProviderName[] = ['anthropic', 'openai', 'ollama'];
      if (!validNames.includes(name as ProviderName)) {
        console.error(`Unknown provider: ${name}. Available: ${validNames.join(', ')}`);
        process.exit(1);
      }

      const p = getProvider(name as ProviderName);
      const available = await isProviderAvailable(p);

      if (!available) {
        console.warn(`Warning: ${name} does not appear to be available on this system.`);
        if (p.cli) console.warn(`  Ensure '${p.cli}' is installed and in PATH.`);
        if (p.apiBase) console.warn(`  Ensure the API is running at ${p.apiBase}`);
      }

      // Write to settings
      const { saveConfig } = await import('../../config/loader.js');
      await saveConfig({ provider: name } as any, 'local');
      console.log(`Active provider set to: ${name}`);
      console.log(`  Model mapping: fast=${p.models.fast}, standard=${p.models.standard}, advanced=${p.models.advanced}`);
    });

  // Show provider status and connectivity
  provider
    .command('status')
    .description('Check connectivity for all providers')
    .action(async () => {
      console.log('\nProvider Status:\n');

      for (const [name, p] of Object.entries(PROVIDERS)) {
        const available = await isProviderAvailable(p);
        const icon = available ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
        console.log(`  ${icon} ${name}`);

        if (name === 'ollama' && available) {
          try {
            const ollama = new OllamaMCP(p.apiBase);
            const models = await ollama.listModels();
            console.log(`    ${models.length} models loaded: ${models.map((m) => m.name).join(', ')}`);
          } catch {
            console.log('    Could not list models');
          }
        }

        if (name === 'openai') {
          const codex = new CodexMCP();
          const codexAvailable = await codex.isAvailable();
          console.log(`    Codex CLI: ${codexAvailable ? 'installed' : 'not found'}`);
          const hasKey = !!process.env.OPENAI_API_KEY;
          console.log(`    OPENAI_API_KEY: ${hasKey ? 'set' : 'not set'}`);
        }

        if (name === 'anthropic') {
          const hasKey = !!process.env.ANTHROPIC_API_KEY;
          console.log(`    ANTHROPIC_API_KEY: ${hasKey ? 'set' : 'not set'}`);
        }
      }
      console.log();
    });

  // List models for a specific provider
  provider
    .command('models [name]')
    .description('List models for a provider (defaults to ollama)')
    .option('--json', 'Output as JSON')
    .action(async (name?: string, options?: { json?: boolean }) => {
      const providerName = (name || 'ollama') as ProviderName;

      if (providerName === 'ollama') {
        const p = getProvider('ollama');
        const ollama = new OllamaMCP(p.apiBase);

        try {
          const models = await ollama.listModels();
          if (options?.json) {
            console.log(JSON.stringify(models, null, 2));
            return;
          }

          console.log(`\nOllama Models (${p.apiBase}):\n`);
          if (models.length === 0) {
            console.log('  No models installed. Run: ollama pull <model>');
            return;
          }
          for (const m of models) {
            const size = `${(m.size / 1e9).toFixed(1)}GB`;
            const details = m.details
              ? `${m.details.family} ${m.details.parameter_size} ${m.details.quantization_level}`
              : '';
            console.log(`  ${m.name.padEnd(30)} ${size.padEnd(8)} ${details}`);
          }
          console.log();
        } catch (err: any) {
          console.error(`Failed to list Ollama models: ${err.message}`);
          console.error(`  Ensure Ollama is running at ${p.apiBase}`);
        }
      } else {
        const p = getProvider(providerName);
        console.log(`\n${providerName} Model Tiers:\n`);
        console.log(`  fast:     ${p.models.fast}`);
        console.log(`  standard: ${p.models.standard}`);
        console.log(`  advanced: ${p.models.advanced}`);
        console.log(`\n  Pass any model name directly with --model <name> to override tiers.\n`);
      }
    });

  // Ollama-specific subcommands
  const ollama = provider
    .command('ollama')
    .description('Ollama-specific operations');

  ollama
    .command('pull <model>')
    .description('Pull/download an Ollama model')
    .action(async (model: string) => {
      const p = getProvider('ollama');
      const client = new OllamaMCP(p.apiBase);
      console.log(`Pulling ${model}...`);
      try {
        await client.pullModel(model);
        console.log(`Successfully pulled ${model}`);
      } catch (err: any) {
        console.error(`Failed: ${err.message}`);
      }
    });

  ollama
    .command('chat <prompt>')
    .description('Quick chat with local Ollama model')
    .option('--model <model>', 'Model name')
    .option('--system <prompt>', 'System prompt')
    .action(async (prompt: string, options: { model?: string; system?: string }) => {
      const p = getProvider('ollama');
      const client = new OllamaMCP(p.apiBase);

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }
      messages.push({ role: 'user', content: prompt });

      try {
        const response = await client.chat(messages, options.model);
        console.log(response.message.content);
      } catch (err: any) {
        console.error(`Chat failed: ${err.message}`);
      }
    });

  ollama
    .command('embed <text>')
    .description('Generate embeddings from text')
    .option('--model <model>', 'Embedding model')
    .option('--json', 'Output raw JSON')
    .action(async (text: string, options: { model?: string; json?: boolean }) => {
      const p = getProvider('ollama');
      const client = new OllamaMCP(p.apiBase);

      try {
        const response = await client.embed(text, options.model);
        if (options.json) {
          console.log(JSON.stringify(response, null, 2));
        } else {
          console.log(`Embedding dimensions: ${response.embedding.length}`);
          console.log(`First 10: [${response.embedding.slice(0, 10).map((n) => n.toFixed(4)).join(', ')}...]`);
        }
      } catch (err: any) {
        console.error(`Embedding failed: ${err.message}`);
      }
    });

  // Fleet subcommands
  const fleet = provider
    .command('fleet')
    .description('Fleet Ollama routing across configured nodes');

  fleet
    .command('status')
    .description('Show fleet health and routing table')
    .action(async () => {
      const f = new OllamaFleet();
      console.log(await f.status());
    });

  fleet
    .command('chat <prompt>')
    .description('Route chat to best fleet node by task type')
    .option('--task <type>', 'Task type: reasoning, coding, embedding, vision, fast, general', 'general')
    .option('--model <model>', 'Force specific model')
    .option('--system <prompt>', 'System prompt')
    .option('--num-ctx <n>', 'Context window size', parseInt as any)
    .action(async (prompt: string, options: { task?: string; model?: string; system?: string; numCtx?: number }) => {
      const f = new OllamaFleet();
      const taskType = (options.task || 'general') as any;

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (options.system) messages.push({ role: 'system', content: options.system });
      messages.push({ role: 'user', content: prompt });

      try {
        const result = await f.chat(messages, taskType, {
          model: options.model,
          num_ctx: options.numCtx,
        });
        console.log(`\x1b[2m[${result._route.reason}]\x1b[0m\n`);
        console.log(result.message.content);
      } catch (err: any) {
        console.error(`Fleet chat failed: ${err.message}`);
      }
    });

  fleet
    .command('fanout <prompt>')
    .description('Send prompt to all fleet nodes simultaneously')
    .option('--system <prompt>', 'System prompt')
    .option('--num-ctx <n>', 'Context window size', parseInt as any)
    .action(async (prompt: string, options: { system?: string; numCtx?: number }) => {
      const f = new OllamaFleet();
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (options.system) messages.push({ role: 'system', content: options.system });
      messages.push({ role: 'user', content: prompt });

      console.log('Fanning out to fleet...\n');
      const results = await f.fanOut(messages, ['reasoning', 'coding', 'general'], {
        num_ctx: options.numCtx,
      });

      for (const r of results) {
        if ('error' in r) {
          console.log(`\x1b[31m✗ ${r.taskType}: ${r.error}\x1b[0m\n`);
        } else {
          console.log(`\x1b[32m● ${r.route.reason}\x1b[0m`);
          console.log(r.response.message.content);
          console.log();
        }
      }
    });

  fleet
    .command('route <task>')
    .description('Show where a task type would route (dry run)')
    .action(async (task: string) => {
      const f = new OllamaFleet();
      try {
        const r = await f.route(task as any);
        console.log(`${task} → ${r.node.name} (${r.node.url}) / ${r.model}`);
        console.log(`Reason: ${r.reason}`);
      } catch (err: any) {
        console.error(err.message);
      }
    });

  // Codex-specific subcommands
  const codex = provider
    .command('codex')
    .description('Codex CLI operations');

  codex
    .command('run <prompt>')
    .description('Run a prompt through Codex CLI')
    .option('--model <model>', 'Model (gpt-4.1, o3, o4-mini)')
    .option('--approval <mode>', 'Approval mode: suggest, auto-edit, full-auto')
    .action(async (prompt: string, options: { model?: string; approval?: string }) => {
      const client = new CodexMCP({
        model: options.model,
        approvalMode: options.approval as any,
      });

      const available = await client.isAvailable();
      if (!available) {
        console.error('Codex CLI is not installed. Install with: npm install -g @openai/codex');
        process.exit(1);
      }

      try {
        const result = await client.runQuiet(prompt, options.model);
        console.log(result.output);
        if (result.exitCode !== 0) {
          process.exit(result.exitCode);
        }
      } catch (err: any) {
        console.error(`Codex failed: ${err.message}`);
      }
    });
}
