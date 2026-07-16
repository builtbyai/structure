/**
 * Hooks System
 *
 * Lifecycle event system inspired by Claude Code's hooks architecture.
 *
 * Events:
 * - SessionStart / SessionEnd
 * - PreCommand / PostCommand
 * - PreToolUse / PostToolUse
 * - ConfigChange
 * - Notification
 */

import { spawn } from 'child_process';
import * as path from 'path';

// Hook event types
export type HookEvent =
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCommand'
  | 'PostCommand'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PreCompact'
  | 'ConfigChange'
  | 'Notification';

// Hook handler types
export type HookType = 'command' | 'http' | 'prompt' | 'agent' | 'mcp_tool';

/** Structured decision a hook can return (Claude Code parity). */
export type HookDecision = 'allow' | 'deny' | 'defer';

export interface HookConfig {
  type: HookType;
  command?: string;
  url?: string;
  prompt?: string;
  /** For type:"mcp_tool" — fully-qualified MCP tool name to dispatch. */
  mcpTool?: string;
  /** For type:"mcp_tool" — args to pass to the MCP tool call. */
  mcpArgs?: Record<string, unknown>;
  timeout?: number;
  async?: boolean;
  statusMessage?: string;
  once?: boolean;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookConfig[];
}

export interface HookRegistry {
  [event: string]: HookMatcher[];
}

export interface HookResult {
  blocked: boolean;
  /** Structured decision — `defer` pauses the tool until an external resume signal. */
  decision?: HookDecision;
  reason?: string;
  output?: string;
  continue?: boolean;
  /** Set when decision === 'defer' — token a resume call must echo back. */
  deferToken?: string;
}

export interface HookInput {
  session_id: string;
  cwd: string;
  hook_event_name: HookEvent;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  command?: string;
  [key: string]: unknown;
}

// Hooks system class
export class HooksSystem {
  private registry: HookRegistry = {};
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
    this.loadHooks();
  }

  private loadHooks(): void {
    // Load hooks from config
    const hooks = this.config.hooks as HookRegistry | undefined;
    if (hooks) {
      this.registry = hooks;
    }
  }

  async emit(event: HookEvent, data: Partial<HookInput>): Promise<HookResult> {
    const matchers = this.registry[event] || [];
    const input: HookInput = {
      session_id: 'default',
      cwd: process.cwd(),
      hook_event_name: event,
      ...data,
    };

    for (const matcher of matchers) {
      // Check if matcher pattern matches
      if (matcher.matcher && data.tool_name) {
        const regex = new RegExp(matcher.matcher);
        if (!regex.test(data.tool_name)) {
          continue;
        }
      }

      // Execute all hooks in this matcher
      for (const hook of matcher.hooks) {
        const result = await this.executeHook(hook, input);
        // Block on explicit deny OR a deferred decision (caller must wait).
        if (result.blocked || result.decision === 'deny' || result.decision === 'defer') {
          return result;
        }
      }
    }

    return { blocked: false, decision: 'allow' };
  }

  private async executeHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    switch (hook.type) {
      case 'command':
        return this.executeCommandHook(hook, input);
      case 'http':
        return this.executeHttpHook(hook, input);
      case 'prompt':
        return this.executePromptHook(hook, input);
      case 'agent':
        return this.executeAgentHook(hook, input);
      case 'mcp_tool':
        return this.executeMcpToolHook(hook, input);
      default:
        return { blocked: false };
    }
  }

  /**
   * Dispatch an MCP tool call as a hook action.
   * Resolved against `config.mcpServers`; returns block/decision based on the tool's response.
   */
  private async executeMcpToolHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    if (!hook.mcpTool) {
      return { blocked: false };
    }
    const servers = this.config.mcpServers as Record<string, { url?: string }> | undefined;
    // Tool name format: "<server>:<tool>" — e.g. "ollama:chat"
    const [serverName, toolName] = hook.mcpTool.split(':');
    const server = servers?.[serverName];
    if (!server?.url || !toolName) {
      return { blocked: false, output: `mcp_tool: unknown server "${serverName}"` };
    }
    try {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, args: hook.mcpArgs ?? {}, input }),
        signal: AbortSignal.timeout((hook.timeout || 30) * 1000),
      });
      if (!response.ok) {
        return { blocked: false, output: `mcp_tool ${hook.mcpTool} returned ${response.status}` };
      }
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        const decision: HookDecision | undefined = json.decision;
        return {
          blocked: decision === 'deny' || json.continue === false,
          decision,
          reason: json.reason,
          deferToken: json.deferToken,
          output: text,
        };
      } catch {
        return { blocked: false, output: text };
      }
    } catch (err) {
      return { blocked: false, output: (err as Error).message };
    }
  }

  private async executeCommandHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    if (!hook.command) {
      return { blocked: false };
    }

    return new Promise((resolve) => {
      const timeout = hook.timeout || 600;
      const child = spawn(hook.command!, [], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout * 1000,
      });

      let stdout = '';
      let stderr = '';

      child.stdin.write(JSON.stringify(input));
      child.stdin.end();

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 2) {
          // Exit code 2 = block (Claude Code convention)
          resolve({
            blocked: true,
            decision: 'deny',
            reason: stderr || 'Blocked by hook',
            output: stdout,
          });
        } else if (code !== 0) {
          // Non-zero = error but don't block
          resolve({
            blocked: false,
            output: stderr,
          });
        } else {
          // Success — parse structured decision if present
          try {
            const json = JSON.parse(stdout);
            const decision: HookDecision | undefined = json.decision;
            const blocked = decision === 'deny' || json.continue === false;
            resolve({
              blocked,
              decision,
              reason: json.reason || json.stopReason,
              deferToken: json.deferToken,
              output: stdout,
            });
          } catch {
            resolve({ blocked: false, output: stdout });
          }
        }
      });

      child.on('error', () => {
        resolve({ blocked: false });
      });
    });
  }

  private async executeHttpHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    if (!hook.url) {
      return { blocked: false };
    }

    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout((hook.timeout || 30) * 1000),
      });

      if (!response.ok) {
        return { blocked: false };
      }

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return {
          blocked: json.continue === false || json.ok === false,
          reason: json.reason || json.stopReason,
        };
      } catch {
        return { blocked: false, output: text };
      }
    } catch {
      return { blocked: false };
    }
  }

  private async executePromptHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    // TODO: Implement prompt-based hook evaluation
    console.log('Prompt hook:', hook.prompt, input);
    return { blocked: false };
  }

  private async executeAgentHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    // TODO: Implement agent-based hook evaluation
    console.log('Agent hook:', hook.prompt, input);
    return { blocked: false };
  }

  on(event: HookEvent, handler: HookConfig): void {
    if (!this.registry[event]) {
      this.registry[event] = [];
    }
    this.registry[event].push({ hooks: [handler] });
  }
}

// Initialize hooks from config
export async function initHooks(config: Record<string, unknown>): Promise<HooksSystem> {
  return new HooksSystem(config);
}
