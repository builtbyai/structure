/**
 * Codex MCP Integration
 *
 * Bridges Structure CLI with OpenAI's Codex CLI tool.
 * Manages Codex-specific MCP server configurations and tool invocations.
 */

import { MCPServerConfig, MCPTool } from './index.js';
import { spawn } from 'child_process';

export interface CodexMCPConfig {
  /** Codex CLI binary path (default: 'codex') */
  binary?: string;
  /** OpenAI API key (reads from OPENAI_API_KEY env if not set) */
  apiKey?: string;
  /** Default model for Codex invocations */
  model?: string;
  /** Codex approval mode: suggest, auto-edit, full-auto */
  approvalMode?: 'suggest' | 'auto-edit' | 'full-auto';
}

/**
 * Codex MCP client - wraps Codex CLI as MCP-compatible tools.
 */
export class CodexMCP {
  private config: CodexMCPConfig;

  constructor(config: CodexMCPConfig = {}) {
    this.config = {
      binary: config.binary || 'codex',
      model: config.model || 'gpt-4.1',
      approvalMode: config.approvalMode || 'suggest',
      ...config,
    };
  }

  /** Get MCP server config for registration */
  getServerConfig(): MCPServerConfig {
    return {
      name: 'codex',
      type: 'stdio',
      command: this.config.binary,
      args: [],
      scope: 'user',
      env: this.config.apiKey ? { OPENAI_API_KEY: this.config.apiKey } : undefined,
    };
  }

  /** List available MCP tools from Codex */
  getTools(): MCPTool[] {
    return [
      {
        name: 'codex_run',
        description: 'Execute a prompt through Codex CLI with full agent capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The prompt/task for Codex' },
            model: { type: 'string', description: 'Model override (e.g., gpt-4.1, o3, o4-mini)' },
            approval_mode: {
              type: 'string',
              enum: ['suggest', 'auto-edit', 'full-auto'],
              description: 'Codex approval mode',
            },
            cwd: { type: 'string', description: 'Working directory' },
          },
          required: ['prompt'],
        },
        server: 'codex',
      },
      {
        name: 'codex_quiet',
        description: 'Run Codex in quiet/print mode — returns only the final output',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The prompt/task' },
            model: { type: 'string', description: 'Model override' },
          },
          required: ['prompt'],
        },
        server: 'codex',
      },
    ];
  }

  /** Execute an MCP tool call */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'codex_run':
        return this.run(
          args.prompt as string,
          {
            model: args.model as string | undefined,
            approvalMode: args.approval_mode as CodexMCPConfig['approvalMode'],
            cwd: args.cwd as string | undefined,
          }
        );
      case 'codex_quiet':
        return this.runQuiet(
          args.prompt as string,
          args.model as string | undefined
        );
      default:
        throw new Error(`Unknown Codex tool: ${toolName}`);
    }
  }

  /** Run Codex CLI with full output */
  async run(
    prompt: string,
    options: { model?: string; approvalMode?: CodexMCPConfig['approvalMode']; cwd?: string } = {}
  ): Promise<{ output: string; exitCode: number }> {
    const model = options.model || this.config.model!;
    const approval = options.approvalMode || this.config.approvalMode!;
    const cwd = options.cwd || process.cwd();

    const args = [
      '--model', model,
      `--approval-mode=${approval}`,
      '--quiet',
      prompt,
    ];

    return this.exec(args, cwd);
  }

  /** Run Codex in quiet mode (output only) */
  async runQuiet(prompt: string, model?: string): Promise<{ output: string; exitCode: number }> {
    const args = [
      '--model', model || this.config.model!,
      '--quiet',
      prompt,
    ];
    return this.exec(args);
  }

  /** Check if Codex CLI is installed */
  async isAvailable(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync(`${this.config.binary} --version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private exec(args: string[], cwd?: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const env: Record<string, string> = { ...process.env } as Record<string, string>;
      if (this.config.apiKey) {
        env.OPENAI_API_KEY = this.config.apiKey;
      }

      const child = spawn(this.config.binary!, args, {
        cwd: cwd || process.cwd(),
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ output: stdout || stderr, exitCode: code ?? 1 });
      });
      child.on('error', (err) => {
        resolve({ output: err.message, exitCode: 1 });
      });
    });
  }
}
