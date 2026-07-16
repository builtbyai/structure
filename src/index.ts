/**
 * STRUCTURE CLI - Main Export
 *
 * Re-exports all public modules for programmatic usage.
 */

// Core systems
export * from './config/loader.js';
export * from './hooks/index.js';
export * from './skills/index.js';
export * from './agents/index.js';
export * from './memory/index.js';
export * from './mcp/index.js';

// Vault (Obsidian-compatible)
export * from './vault/index.js';

// Commands (only export registerCommands to avoid duplicate interface exports)
export { registerCommands } from './commands/index.js';

// TUI
export { TUI, SHORTCUTS } from './tui/index.js';

// Utilities
export * from './utils/index.js';
