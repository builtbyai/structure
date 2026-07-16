/**
 * Memory System
 *
 * Persistent context management inspired by Claude Code's memory architecture.
 *
 * Three-tier system:
 * 1. User-level: ~/.structure/MEMORY.md
 * 2. Project-level: ./STRUCTURE.md
 * 3. Auto-memory: Learned patterns stored in ~/.structure/projects/<project>/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// Memory entry
export interface MemoryEntry {
  key: string;
  value: unknown;
  source: 'user' | 'project' | 'auto';
  timestamp: Date;
}

// STRUCTURE.md content
export interface StructureFile {
  path: string;
  content: string;
  scope: 'user' | 'project' | 'local';
}

// Memory system
export class MemorySystem {
  private entries: Map<string, MemoryEntry> = new Map();
  private structureFiles: StructureFile[] = [];
  private projectDir: string;
  private projectId: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.projectId = this.generateProjectId(projectDir);
  }

  private generateProjectId(dir: string): string {
    return crypto.createHash('md5').update(dir).digest('hex').substring(0, 16);
  }

  async load(): Promise<void> {
    await this.loadStructureFiles();
    await this.loadAutoMemory();
  }

  private async loadStructureFiles(): Promise<void> {
    const homedir = process.env.HOME || process.env.USERPROFILE || '';

    // Load in order of priority (lowest to highest)
    const locations = [
      // User-level
      { path: path.join(homedir, '.structure', 'STRUCTURE.md'), scope: 'user' as const },
      // Project-level
      { path: path.join(this.projectDir, 'STRUCTURE.md'), scope: 'project' as const },
      // Local (not committed)
      { path: path.join(this.projectDir, '.structure', 'STRUCTURE.local.md'), scope: 'local' as const },
    ];

    for (const loc of locations) {
      try {
        const content = await fs.readFile(loc.path, 'utf-8');
        this.structureFiles.push({
          path: loc.path,
          content,
          scope: loc.scope,
        });
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  private async loadAutoMemory(): Promise<void> {
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    const memoryDir = path.join(homedir, '.structure', 'projects', this.projectId, 'memory');

    try {
      const memoryFile = path.join(memoryDir, 'MEMORY.md');
      const content = await fs.readFile(memoryFile, 'utf-8');

      // Parse memory entries from markdown
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
        if (match) {
          this.entries.set(match[1], {
            key: match[1],
            value: match[2],
            source: 'auto',
            timestamp: new Date(),
          });
        }
      }
    } catch {
      // No auto memory yet
    }
  }

  get(key: string): unknown {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: unknown, source: 'user' | 'project' | 'auto' = 'auto'): void {
    this.entries.set(key, {
      key,
      value,
      source,
      timestamp: new Date(),
    });
  }

  async save(): Promise<void> {
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    const memoryDir = path.join(homedir, '.structure', 'projects', this.projectId, 'memory');

    // Ensure directory exists
    await fs.mkdir(memoryDir, { recursive: true });

    // Build memory content
    const autoEntries = Array.from(this.entries.values())
      .filter(e => e.source === 'auto');

    if (autoEntries.length === 0) return;

    const content = [
      '# Auto Memory',
      '',
      `> Project: ${this.projectDir}`,
      `> Updated: ${new Date().toISOString()}`,
      '',
      ...autoEntries.map(e => `- **${e.key}**: ${e.value}`),
    ].join('\n');

    await fs.writeFile(path.join(memoryDir, 'MEMORY.md'), content);
  }

  getStructureFiles(): StructureFile[] {
    return this.structureFiles;
  }

  getCombinedContext(): string {
    return this.structureFiles
      .map(f => `# ${f.scope.toUpperCase()} STRUCTURE\n\n${f.content}`)
      .join('\n\n---\n\n');
  }

  listEntries(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }
}

// Load rules from .structure/rules/
export async function loadRules(projectDir: string): Promise<Map<string, string>> {
  const rules = new Map<string, string>();
  const rulesDir = path.join(projectDir, '.structure', 'rules');

  try {
    const entries = await fs.readdir(rulesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const rulePath = path.join(rulesDir, entry.name);
        const content = await fs.readFile(rulePath, 'utf-8');
        rules.set(entry.name.replace('.md', ''), content);
      }
    }
  } catch {
    // Rules directory doesn't exist
  }

  return rules;
}

// Initialize memory system
export async function initMemory(config: Record<string, unknown>): Promise<MemorySystem> {
  const projectDir = process.cwd();
  const memory = new MemorySystem(projectDir);
  await memory.load();
  return memory;
}
