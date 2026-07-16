/**
 * MCP (Model Context Protocol) Integration
 *
 * Connect to external tools via MCP servers.
 * Inspired by Claude Code's MCP architecture.
 */

import { spawn, ChildProcess } from 'child_process';

// MCP server types
export type MCPTransport = 'stdio' | 'http' | 'sse';

// MCP server configuration
export interface MCPServerConfig {
  name: string;
  type: MCPTransport;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  scope: 'local' | 'project' | 'user';
}

// MCP tool definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  server: string;
}

// MCP resource
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  server: string;
}

// MCP server connection
export class MCPServer {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private connected: boolean = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    switch (this.config.type) {
      case 'stdio':
        await this.connectStdio();
        break;
      case 'http':
      case 'sse':
        await this.connectHttp();
        break;
    }
  }

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Stdio server requires command');
    }

    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env },
    });

    this.connected = true;
  }

  private async connectHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error('HTTP server requires URL');
    }

    // Test connection
    try {
      const response = await fetch(this.config.url, {
        headers: this.config.headers,
      });
      this.connected = response.ok;
    } catch {
      this.connected = false;
      throw new Error(`Failed to connect to ${this.config.url}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listTools(): Promise<MCPTool[]> {
    // TODO: Implement MCP tools/list
    return [];
  }

  async listResources(): Promise<MCPResource[]> {
    // TODO: Implement MCP resources/list
    return [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement MCP tools/call
    console.log(`Calling MCP tool: ${name}`, args);
    return null;
  }

  async readResource(uri: string): Promise<string> {
    // TODO: Implement MCP resources/read
    console.log(`Reading MCP resource: ${uri}`);
    return '';
  }
}

// MCP registry
export class MCPRegistry {
  private servers: Map<string, MCPServer> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  async addServer(config: MCPServerConfig): Promise<void> {
    const server = new MCPServer(config);
    await server.connect();
    this.servers.set(config.name, server);

    // Index tools from this server
    const tools = await server.listTools();
    for (const tool of tools) {
      this.tools.set(`mcp__${config.name}__${tool.name}`, tool);
    }
  }

  async removeServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.disconnect();
      this.servers.delete(name);

      // Remove tools from this server
      for (const [key, tool] of this.tools.entries()) {
        if (tool.server === name) {
          this.tools.delete(key);
        }
      }
    }
  }

  getServer(name: string): MCPServer | undefined {
    return this.servers.get(name);
  }

  listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values()).map(s => (s as any).config);
  }

  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`MCP tool not found: ${toolName}`);
    }

    const server = this.servers.get(tool.server);
    if (!server) {
      throw new Error(`MCP server not connected: ${tool.server}`);
    }

    return server.callTool(tool.name, args);
  }
}

// Re-export provider-specific MCP integrations
export { OllamaMCP } from './ollama.js';
export { CodexMCP } from './codex.js';

// CLI commands for MCP management (provider-aware)
export const mcpCommands = {
  // Claude/Anthropic
  claude: {
    add: 'claude mcp add --transport <type> <name> <url|command>',
    remove: 'claude mcp remove <name>',
    list: 'claude mcp list',
    get: 'claude mcp get <name>',
  },
  // Codex/OpenAI
  codex: {
    run: 'codex --model <model> --approval-mode <mode> "<prompt>"',
    quiet: 'codex --quiet "<prompt>"',
  },
  // Ollama (local)
  ollama: {
    list: 'ollama list',
    pull: 'ollama pull <model>',
    run: 'ollama run <model> "<prompt>"',
    serve: 'ollama serve',
  },
};
