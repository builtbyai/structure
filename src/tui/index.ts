/**
 * Terminal User Interface
 *
 * Interactive TUI with autocomplete and history.
 * Inspired by Obsidian CLI's terminal interface.
 */

import * as readline from 'readline';
import { Config } from '../config/loader.js';
import { SkillRegistry } from '../skills/index.js';
import { executeSkill } from '../skills/runner.js';

// TUI state
interface TUIState {
  history: string[];
  historyIndex: number;
  running: boolean;
}

// Command suggestion
interface Suggestion {
  command: string;
  description: string;
}

// Available commands for autocomplete
const COMMANDS: Suggestion[] = [
  { command: 'help', description: 'Show help' },
  { command: 'version', description: 'Show version' },
  { command: 'config', description: 'View/edit config' },
  { command: 'reload', description: 'Reload config' },
  { command: 'init', description: 'Initialize project' },
  { command: 'files', description: 'List files' },
  { command: 'read', description: 'Read file' },
  { command: 'create', description: 'Create file' },
  { command: 'write', description: 'Write to file' },
  { command: 'move', description: 'Move file' },
  { command: 'delete', description: 'Delete file' },
  { command: 'search', description: 'Search content' },
  { command: 'grep', description: 'Pattern search' },
  { command: 'glob', description: 'File pattern' },
  { command: 'tasks', description: 'List tasks' },
  { command: 'task:create', description: 'Create task' },
  { command: 'task:update', description: 'Update task' },
  { command: 'task:complete', description: 'Complete task' },
  { command: 'dev:debug', description: 'Debug mode' },
  { command: 'dev:eval', description: 'Evaluate code' },
  { command: 'dev:inspect', description: 'Inspect state' },
  { command: 'doctor', description: 'Run diagnostics' },
  { command: 'exit', description: 'Exit TUI' },
  { command: 'quit', description: 'Exit TUI' },
];

export class TUI {
  private config: Config;
  private state: TUIState;
  private rl: readline.Interface | null = null;
  private skills: SkillRegistry | null;

  constructor(config: Config, skills: SkillRegistry | null = null) {
    this.config = config;
    this.skills = skills;
    this.state = {
      history: [],
      historyIndex: -1,
      running: false,
    };
  }

  async start(): Promise<void> {
    this.state.running = true;

    console.log('');
    console.log('  STRUCTURE CLI v0.1.0');
    console.log('  Type "help" for available commands, "exit" to quit');
    console.log('');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.completer.bind(this),
      prompt: '> ',
    });

    // Handle history navigation
    process.stdin.on('keypress', (char, key) => {
      if (!key) return;

      if (key.name === 'up' && this.state.historyIndex < this.state.history.length - 1) {
        this.state.historyIndex++;
        const cmd = this.state.history[this.state.history.length - 1 - this.state.historyIndex];
        this.rl?.write(null, { ctrl: true, name: 'u' });
        this.rl?.write(cmd);
      } else if (key.name === 'down' && this.state.historyIndex > 0) {
        this.state.historyIndex--;
        const cmd = this.state.history[this.state.history.length - 1 - this.state.historyIndex];
        this.rl?.write(null, { ctrl: true, name: 'u' });
        this.rl?.write(cmd);
      }
    });

    this.safePrompt();

    for await (const line of this.rl) {
      const input = line.trim();

      if (!input) {
        this.safePrompt();
        continue;
      }

      // Add to history
      this.state.history.push(input);
      this.state.historyIndex = -1;

      // Handle exit
      if (input === 'exit' || input === 'quit') {
        this.stop();
        break;
      }

      // Execute command
      await this.executeCommand(input);

      if (this.state.running) {
        this.safePrompt();
      }
    }
  }

  stop(): void {
    this.state.running = false;
    if (this.rl && !(this.rl as readline.Interface & { closed?: boolean }).closed) {
      this.rl.close();
    }
    console.log('Goodbye!');
  }

  private safePrompt(): void {
    if (!this.rl) {
      return;
    }

    if ((this.rl as readline.Interface & { closed?: boolean }).closed) {
      return;
    }

    try {
      this.rl.prompt();
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || (error as Error & { code?: string }).code !== 'ERR_USE_AFTER_CLOSE') {
        throw error;
      }
    }
  }

  private completer(line: string): [string[], string] {
    const completions = COMMANDS.map(c => c.command);
    const hits = completions.filter(c => c.startsWith(line));
    return [hits.length ? hits : completions, line];
  }

  private async executeCommand(input: string): Promise<void> {
    const [command, ...args] = input.split(/\s+/);

    // Handle skill invocation (starts with /)
    if (command.startsWith('/')) {
      const skillName = command.slice(1);
      if (!this.skills) {
        console.log('Skills are not initialized.');
        return;
      }

      try {
        const result = await executeSkill(this.skills, skillName, args, {
          config: this.config as Record<string, unknown>,
        });
        console.log(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Skill error: ${message}`);
      }
      return;
    }

    // Find and execute command
    const cmd = COMMANDS.find(c => c.command === command);
    if (!cmd) {
      console.log(`Unknown command: ${command}`);
      console.log('Type "help" for available commands');
      return;
    }

    // TODO: Route to actual command handlers
    console.log(`Executing: ${command}`, args);
  }
}

// Keyboard shortcuts reference
export const SHORTCUTS = {
  'Ctrl+A': 'Move to start of line',
  'Ctrl+E': 'Move to end of line',
  'Ctrl+U': 'Clear line',
  'Ctrl+W': 'Delete word',
  'Ctrl+R': 'Reverse search history',
  'Tab': 'Autocomplete',
  'Up/Down': 'Navigate history',
};
