#!/usr/bin/env node
/**
 * STRUCTURE CLI - Main Entry Point
 *
 * Inspired by Obsidian CLI and Claude Code architectures
 * Supports Obsidian vault operations with multi-vault runtime configuration
 */

import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { initHooks } from '../hooks/index.js';
import { initMemory } from '../memory/index.js';
import { TUI } from '../tui/index.js';
import { registerCommands } from '../commands/index.js';
import { vaultManager } from '../vault/index.js';
import { setActiveVault } from '../commands/vault/index.js';
import { initSkills } from '../skills/index.js';
import { executeSkill } from '../skills/runner.js';

let config: Record<string, unknown> = {};

function extractCliConfigOptions(argv: string[]): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--provider' && argv[i + 1]) {
      options.provider = argv[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith('--provider=')) {
      options.provider = arg.slice('--provider='.length);
      continue;
    }

    if (arg === '--model' && argv[i + 1]) {
      options.model = argv[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith('--model=')) {
      options.model = arg.slice('--model='.length);
      continue;
    }

    if (arg === '--vault' && argv[i + 1]) {
      options.vault = { path: argv[i + 1] };
      i++;
      continue;
    }

    if (arg.startsWith('--vault=')) {
      options.vault = { path: arg.slice('--vault='.length) };
      continue;
    }

    if (arg === '--debug') {
      options.debug = true;
    }
  }

  return options;
}

const program = new Command();

program
  .name('structure')
  .description('Modern CLI framework with skills, hooks, agents, and Obsidian vault support')
  .version('0.1.0');

// Global options
program
  .option('-p, --print', 'Print mode (non-interactive)')
  .option('-c, --continue', 'Continue previous session')
  .option('--config <path>', 'Config file path')
  .option('--vault <path>', 'Obsidian vault path')
  .option('--agent <name>', 'Use specific agent')
  .option('--skill <name>', 'Invoke a skill')
  .option('--model <model>', 'Specify model (fast|standard|advanced)')
  .option('--provider <name>', 'AI provider (anthropic|openai|ollama)')
  .option('--debug', 'Enable debug mode');

// Pre-action hook to initialize vault before any command runs
program.hook('preAction', async (thisCommand) => {
  const opts = thisCommand.opts();
  const vaultPath = opts.vault || (config as any).vault?.path;

  if (vaultPath) {
    try {
      const vault = await vaultManager.open(vaultPath);
      setActiveVault(vault);
      if (opts.debug) {
        console.log(`Vault opened: ${vault.name} (${vault.vaultPath})`);
      }
    } catch (error: any) {
      console.error(`Failed to open vault: ${error.message}`);
      process.exit(1);
    }
  }
});

// Register all command modules
registerCommands(program);

// Main execution
async function main() {
  try {
    // Load configuration (merges all scopes)
    config = await loadConfig(extractCliConfigOptions(process.argv.slice(2)));

    // Initialize hooks system
    await initHooks(config);

    // Initialize memory/context
    await initMemory(config);

    const skills = await initSkills(process.cwd(), ((config as any).skillPaths || []) as string[]);

    const skillIndex = process.argv.indexOf('--skill');
    if (skillIndex !== -1) {
      const skillName = process.argv[skillIndex + 1];
      if (!skillName) {
        throw new Error('Missing skill name after --skill');
      }

      const skillArgs = process.argv.slice(skillIndex + 2);
      const result = await executeSkill(skills, skillName, skillArgs, { config });
      console.log(result);
      return;
    }

    // Check if running interactively or with args
    if (process.argv.length <= 2) {
      // Start TUI mode
      const tui = new TUI(config, skills);
      await tui.start();
    } else {
      // Parse and execute command
      await program.parseAsync(process.argv);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
