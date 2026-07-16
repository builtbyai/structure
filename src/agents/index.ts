/**
 * Agents System
 *
 * Subagent orchestration inspired by Claude Code's agent architecture.
 * Agents are specialized workers with custom tools and models.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { spawn, ChildProcess } from 'child_process';
import {
  ProviderName,
  ProviderConfig,
  getProvider,
  resolveModel,
  buildProviderCliArgs,
} from '../config/providers.js';

// Agent invocation result
export interface AgentResult {
  success: boolean;
  output: string;
  summary?: string;
  error?: string;
  exitCode: number;
  duration: number;
}

// Agent invocation options
export interface InvokeOptions {
  /** Working directory for the agent */
  cwd?: string;
  /** Environment variables to pass */
  env?: Record<string, string>;
  /** Callback for streaming output */
  onOutput?: (chunk: string, type: 'stdout' | 'stderr') => void;
  /** Callback when agent completes */
  onComplete?: (result: AgentResult) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// Agent definition
export interface Agent {
  name: string;
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: 'fast' | 'standard' | 'advanced' | 'inherit';
  permissionMode?: 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions' | 'plan';
  maxTurns?: number;
  skills?: string[];
  mcpServers?: string[];
  memory?: 'user' | 'project' | 'local';
  background?: boolean;
  isolation?: 'worktree';
  hooks?: Record<string, unknown>;
  prompt: string;
  path: string;
}

// Agent frontmatter
export interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  disallowedTools?: string;
  model?: string;
  permissionMode?: string;
  maxTurns?: number;
  skills?: string[];
  mcpServers?: string[];
  memory?: string;
  background?: boolean;
  isolation?: string;
  hooks?: Record<string, unknown>;
}

// Built-in agents
const BUILTIN_AGENTS: Partial<Agent>[] = [
  {
    name: 'Explore',
    description: 'Fast file discovery and codebase exploration',
    tools: ['Read', 'Grep', 'Glob', 'LS'],
    disallowedTools: ['Write', 'Edit'],
    model: 'fast',
    prompt: 'You are an exploration agent. Search and read files to answer questions about the codebase.',
  },
  {
    name: 'Plan',
    description: 'Codebase research for planning',
    model: 'inherit',
    permissionMode: 'plan',
    prompt: 'You are a planning agent. Analyze the codebase and create implementation plans.',
  },
  {
    name: 'Bash',
    description: 'Terminal command execution',
    tools: ['Bash'],
    model: 'inherit',
    prompt: 'You are a shell agent. Execute terminal commands.',
  },
];

// Agent registry
export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private searchPaths: string[];
  private provider: ProviderConfig;

  constructor(searchPaths: string[], providerName?: ProviderName) {
    this.searchPaths = searchPaths;
    this.provider = getProvider(providerName || 'anthropic');
    this.loadBuiltins();
  }

  private loadBuiltins(): void {
    for (const agent of BUILTIN_AGENTS) {
      if (agent.name) {
        this.agents.set(agent.name, {
          ...agent,
          path: 'builtin',
          prompt: agent.prompt || '',
        } as Agent);
      }
    }
  }

  async load(): Promise<void> {
    for (const searchPath of this.searchPaths) {
      await this.loadFromPath(searchPath);
    }
  }

  private async loadFromPath(basePath: string): Promise<void> {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const agentPath = path.join(basePath, entry.name);
          try {
            const agent = await this.parseAgentFile(agentPath);
            if (agent) {
              this.agents.set(agent.name, agent);
            }
          } catch {
            // Skip invalid agent files
          }
        }
      }
    } catch {
      // Path doesn't exist, skip
    }
  }

  private async parseAgentFile(filePath: string): Promise<Agent | null> {
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = yaml.load(frontmatterMatch[1]) as AgentFrontmatter;
    const body = frontmatterMatch[2].trim();

    if (!frontmatter.name || !frontmatter.description) {
      return null;
    }

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      tools: frontmatter.tools?.split(',').map(t => t.trim()),
      disallowedTools: frontmatter.disallowedTools?.split(',').map(t => t.trim()),
      model: frontmatter.model as Agent['model'],
      permissionMode: frontmatter.permissionMode as Agent['permissionMode'],
      maxTurns: frontmatter.maxTurns,
      skills: frontmatter.skills,
      mcpServers: frontmatter.mcpServers,
      memory: frontmatter.memory as Agent['memory'],
      background: frontmatter.background,
      isolation: frontmatter.isolation as Agent['isolation'],
      hooks: frontmatter.hooks,
      prompt: body,
      path: filePath,
    };
  }

  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  list(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Invoke an agent with streaming output and final summary
   */
  async invoke(
    name: string,
    userPrompt: string,
    options: InvokeOptions = {}
  ): Promise<AgentResult> {
    const agent = this.get(name);
    if (!agent) {
      throw new Error(`Agent not found: ${name}`);
    }

    const startTime = Date.now();
    const cwd = options.cwd || process.cwd();

    // Build the combined prompt
    const combinedPrompt = this.buildPrompt(agent, userPrompt);

    // Build provider-specific invocation
    const invocation = this.buildInvocation(agent, combinedPrompt);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      // Spawn provider CLI process (claude, codex, or ollama)
      const child = spawn(invocation.command, invocation.args, {
        cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...options.env },
      });

      // Handle abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          child.kill('SIGTERM');
        });
      }

      // Stream stdout
      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        options.onOutput?.(chunk, 'stdout');
      });

      // Stream stderr
      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        options.onOutput?.(chunk, 'stderr');
      });

      // Handle completion
      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result: AgentResult = {
          success: code === 0,
          output: stdout,
          summary: this.extractSummary(stdout),
          error: stderr || undefined,
          exitCode: code ?? 1,
          duration,
        };

        options.onComplete?.(result);
        resolve(result);
      });

      child.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          output: '',
          error: err.message,
          exitCode: 1,
          duration,
        });
      });
    });
  }

  /**
   * Invoke agent in background (non-blocking)
   */
  invokeBackground(
    name: string,
    userPrompt: string,
    options: InvokeOptions = {}
  ): { process: ChildProcess; result: Promise<AgentResult> } {
    const agent = this.get(name);
    if (!agent) {
      throw new Error(`Agent not found: ${name}`);
    }

    const startTime = Date.now();
    const cwd = options.cwd || process.cwd();
    const combinedPrompt = this.buildPrompt(agent, userPrompt);
    const invocation = this.buildInvocation(agent, combinedPrompt);

    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, ...options.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      options.onOutput?.(chunk, 'stdout');
    });

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      options.onOutput?.(chunk, 'stderr');
    });

    const result = new Promise<AgentResult>((resolve) => {
      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          output: stdout,
          summary: this.extractSummary(stdout),
          error: stderr || undefined,
          exitCode: code ?? 1,
          duration,
        });
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          output: '',
          error: err.message,
          exitCode: 1,
          duration: Date.now() - startTime,
        });
      });
    });

    return { process: child, result };
  }

  /**
   * Build provider invocation based on agent config, using the active provider's model mapping.
   */
  private buildInvocation(agent: Agent, prompt: string): { command: string; args: string[] } {
    const modelTier = agent.model && agent.model !== 'inherit' ? agent.model : 'standard';
    const model = resolveModel(this.provider, modelTier);

    return buildProviderCliArgs(this.provider, model, prompt, {
      allowedTools: agent.tools,
      disallowedTools: agent.disallowedTools,
      maxTurns: agent.maxTurns,
      print: true,
    });
  }

  /** Get the active provider */
  getProvider(): ProviderConfig {
    return this.provider;
  }

  /** Switch the active provider at runtime */
  setProvider(name: ProviderName): void {
    this.provider = getProvider(name);
  }

  /**
   * Combine agent system prompt with user prompt
   */
  private buildPrompt(agent: Agent, userPrompt: string): string {
    return `${agent.prompt}\n\n---\n\nTask: ${userPrompt}`;
  }

  /**
   * Extract summary from agent output
   * TODO: User implements summary extraction strategy
   */
  private extractSummary(output: string): string | undefined {
    // Default: return last paragraph as summary
    const paragraphs = output.trim().split(/\n\n+/);
    return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : undefined;
  }
}

// Initialize agents from standard paths
export async function initAgents(
  projectDir: string,
  providerName?: ProviderName
): Promise<AgentRegistry> {
  const homedir = process.env.HOME || process.env.USERPROFILE || '';

  const searchPaths = [
    // Project agents (highest priority)
    path.join(projectDir, '.structure', 'agents'),
    // User agents
    path.join(homedir, '.structure', 'agents'),
  ];

  const registry = new AgentRegistry(searchPaths, providerName);
  await registry.load();
  return registry;
}
