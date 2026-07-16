/**
 * Command Registry
 *
 * Registers all command modules with the CLI program.
 * Inspired by Obsidian CLI's modular command structure.
 */

import { Command } from 'commander';
import { coreCommands } from './core/index.js';
import { fileCommands } from './files/index.js';
import { searchCommands } from './search/index.js';
import { taskCommands } from './tasks/index.js';
import { devCommands } from './dev/index.js';
import { vaultCommands } from './vault/index.js';
import { providerCommands } from './provider/index.js';
import { usageCommands } from './usage/index.js';
import { analyzeCommands } from './analyze/index.js';

export function registerCommands(program: Command): void {
  // Core commands (help, version, config)
  coreCommands(program);

  // File operations
  fileCommands(program);

  // Search operations
  searchCommands(program);

  // Task management
  taskCommands(program);

  // Developer tools
  devCommands(program);

  // Vault operations (Obsidian-compatible)
  vaultCommands(program);

  // AI provider management (Anthropic, OpenAI/Codex, Ollama)
  providerCommands(program);

  // Usage / cost / cache-hit reporting
  usageCommands(program);

  // Vision analysis (`structure analyze <files...>`)
  analyzeCommands(program);
}

// Command interface for type safety
export interface CommandContext {
  config: Record<string, unknown>;
  hooks: HookSystem;
  memory: MemorySystem;
  agents: AgentRegistry;
}

export interface HookSystem {
  emit(event: string, data: unknown): Promise<HookResult>;
  on(event: string, handler: HookHandler): void;
}

export interface HookResult {
  blocked: boolean;
  reason?: string;
  modifiedData?: unknown;
}

export type HookHandler = (data: unknown) => Promise<HookResult>;

export interface MemorySystem {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  load(): Promise<void>;
  save(): Promise<void>;
}

export interface AgentRegistry {
  get(name: string): Agent | undefined;
  list(): Agent[];
  invoke(name: string, prompt: string): Promise<string>;
}

export interface Agent {
  name: string;
  description: string;
  tools: string[];
  model?: string;
}
