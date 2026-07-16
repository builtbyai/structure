/**
 * Configuration Loader
 *
 * Multi-scope configuration system inspired by Claude Code's settings architecture.
 *
 * Priority (highest to lowest):
 * 1. CLI flags
 * 2. Local settings (.structure/settings.local.json)
 * 3. Project settings (.structure/settings.json)
 * 4. User settings (~/.structure/settings.json)
 * 5. Defaults
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Configuration schema
export interface Config {
  // Core settings
  debug?: boolean;
  verbose?: boolean;
  color?: boolean;

  // AI provider (anthropic, openai, ollama)
  provider?: 'anthropic' | 'openai' | 'ollama';

  // Provider-specific overrides
  providerConfig?: {
    anthropic?: { apiKey?: string; models?: Record<string, string> };
    openai?: { apiKey?: string; models?: Record<string, string>; approvalMode?: string };
    ollama?: { apiBase?: string; defaultModel?: string; models?: Record<string, string> };
  };

  // Model settings (tier — resolved to provider-specific model at runtime)
  model?: 'fast' | 'standard' | 'advanced';

  // Permission settings
  permissions?: {
    allow?: string[];
    deny?: string[];
  };

  // Auto memory
  autoMemoryEnabled?: boolean;

  // Hooks
  hooks?: Record<string, unknown>;

  // MCP servers
  mcpServers?: Record<string, unknown>;

  // Additional skill search paths (network shares, global directories, etc.)
  skillPaths?: string[];

  // Custom settings
  [key: string]: unknown;
}

// Default configuration
const DEFAULT_CONFIG: Config = {
  debug: false,
  verbose: false,
  color: true,
  provider: 'anthropic',
  providerConfig: {},
  model: 'standard',
  autoMemoryEnabled: true,
  permissions: {
    allow: [],
    deny: [],
  },
  hooks: {},
  mcpServers: {},
};

// Load JSON file safely
async function loadJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Deep merge objects
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// Load configuration from all scopes
export async function loadConfig(cliOptions: Partial<Config> = {}): Promise<Config> {
  const homedir = process.env.HOME || process.env.USERPROFILE || '';
  const projectDir = process.cwd();

  // Configuration file locations (lowest to highest priority)
  const configPaths = [
    // User settings
    path.join(homedir, '.structure', 'settings.json'),
    // Project settings
    path.join(projectDir, '.structure', 'settings.json'),
    // Local settings (not committed)
    path.join(projectDir, '.structure', 'settings.local.json'),
  ];

  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Load and merge each config file
  for (const configPath of configPaths) {
    const fileConfig = await loadJsonFile(configPath);
    if (fileConfig) {
      config = deepMerge(config, fileConfig) as Config;
    }
  }

  // Apply CLI options (highest priority)
  config = deepMerge(config, cliOptions as Record<string, unknown>) as Config;

  return config;
}

// Save configuration to a specific scope
export async function saveConfig(
  config: Partial<Config>,
  scope: 'user' | 'project' | 'local' = 'local'
): Promise<void> {
  const homedir = process.env.HOME || process.env.USERPROFILE || '';
  const projectDir = process.cwd();

  let configPath: string;
  switch (scope) {
    case 'user':
      configPath = path.join(homedir, '.structure', 'settings.json');
      break;
    case 'project':
      configPath = path.join(projectDir, '.structure', 'settings.json');
      break;
    case 'local':
      configPath = path.join(projectDir, '.structure', 'settings.local.json');
      break;
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  // Load existing config and merge
  const existing = (await loadJsonFile(configPath)) || {};
  const merged = deepMerge(existing, config as Record<string, unknown>);

  // Write back
  await fs.writeFile(configPath, JSON.stringify(merged, null, 2));
}

// Get a specific config value
export function getConfigValue(config: Config, key: string): unknown {
  const parts = key.split('.');
  let value: unknown = config;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

// Set a specific config value
export function setConfigValue(config: Config, key: string, value: unknown): Config {
  const parts = key.split('.');
  const result = { ...config };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}
