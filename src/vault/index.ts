/**
 * Vault Module
 *
 * Obsidian-compatible vault operations for reading, writing, and searching notes.
 * Supports multiple vaults with runtime path configuration.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// Types
// ============================================================================

export interface VaultConfig {
  path: string;
  name?: string;
  dailyNotesFolder?: string;
  dailyNotesFormat?: string;
  templatesFolder?: string;
  attachmentsFolder?: string;
}

export interface Note {
  path: string;
  relativePath: string;
  name: string;
  content: string;
  frontmatter: Record<string, unknown>;
  body: string;
  tags: string[];
  links: NoteLink[];
  backlinks: string[];
  created?: Date;
  modified?: Date;
}

export interface NoteLink {
  target: string;
  display?: string;
  type: 'wikilink' | 'markdown';
  line: number;
}

export interface SearchResult {
  note: string;
  relativePath: string;
  matches: SearchMatch[];
  score: number;
}

export interface SearchMatch {
  line: number;
  column: number;
  text: string;
  context: string;
}

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  regex?: boolean;
  limit?: number;
  includeContent?: boolean;
  filePattern?: string;
  folder?: string;
  tags?: string[];
}

export interface DailyNoteOptions {
  date?: Date;
  template?: string;
  open?: boolean;
}

// ============================================================================
// Vault Class
// ============================================================================

export class Vault {
  private config: VaultConfig;
  private noteCache: Map<string, Note> = new Map();

  constructor(vaultPath: string, options: Partial<VaultConfig> = {}) {
    this.config = {
      path: path.resolve(vaultPath),
      name: options.name || path.basename(vaultPath),
      dailyNotesFolder: options.dailyNotesFolder || 'Daily Notes',
      dailyNotesFormat: options.dailyNotesFormat || 'YYYY-MM-DD',
      templatesFolder: options.templatesFolder || 'Templates',
      attachmentsFolder: options.attachmentsFolder || 'Attachments',
    };
  }

  get vaultPath(): string {
    return this.config.path;
  }

  get name(): string {
    return this.config.name || '';
  }

  async exists(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.config.path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async isObsidianVault(): Promise<boolean> {
    try {
      const obsidianFolder = path.join(this.config.path, '.obsidian');
      const stats = await fs.stat(obsidianFolder);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{
    noteCount: number;
    folderCount: number;
    tagCount: number;
    totalSize: number;
  }> {
    const notes = await this.listNotes();
    const folders = await this.listFolders();
    const tags = new Set<string>();
    let totalSize = 0;

    for (const notePath of notes) {
      const note = await this.readNote(notePath);
      if (note) {
        note.tags.forEach(tag => tags.add(tag));
        totalSize += note.content.length;
      }
    }

    return {
      noteCount: notes.length,
      folderCount: folders.length,
      tagCount: tags.size,
      totalSize,
    };
  }

  // --------------------------------------------------------------------------
  // Note Operations (CRUD)
  // --------------------------------------------------------------------------

  async createNote(
    relativePath: string,
    content: string = '',
    options: { overwrite?: boolean; template?: string } = {}
  ): Promise<Note> {
    const fullPath = this.resolvePath(relativePath);

    if (!options.overwrite) {
      try {
        await fs.access(fullPath);
        throw new Error('Note already exists: ' + relativePath);
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
      }
    }

    let noteContent = content;
    if (options.template) {
      noteContent = await this.applyTemplate(options.template, {
        title: path.basename(relativePath, '.md'),
        date: new Date().toISOString().split('T')[0],
      });
    }

    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, noteContent, 'utf-8');

    return this.parseNote(fullPath, noteContent);
  }

  async readNote(relativePath: string): Promise<Note | null> {
    const fullPath = this.resolvePath(relativePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      const note = this.parseNote(fullPath, content);
      note.created = stats.birthtime;
      note.modified = stats.mtime;
      return note;
    } catch (e: any) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async updateNote(
    relativePath: string,
    content: string,
    options: { createIfMissing?: boolean } = {}
  ): Promise<Note> {
    const fullPath = this.resolvePath(relativePath);

    try {
      await fs.access(fullPath);
    } catch {
      if (options.createIfMissing) {
        return this.createNote(relativePath, content);
      }
      throw new Error('Note not found: ' + relativePath);
    }

    await fs.writeFile(fullPath, content, 'utf-8');
    this.noteCache.delete(relativePath);

    return this.parseNote(fullPath, content);
  }

  async appendToNote(relativePath: string, content: string): Promise<Note> {
    const note = await this.readNote(relativePath);
    if (!note) {
      throw new Error('Note not found: ' + relativePath);
    }

    const newContent = note.content + '\n' + content;
    return this.updateNote(relativePath, newContent);
  }

  async prependToNote(relativePath: string, content: string): Promise<Note> {
    const note = await this.readNote(relativePath);
    if (!note) {
      throw new Error('Note not found: ' + relativePath);
    }

    let newContent: string;
    if (note.frontmatter && Object.keys(note.frontmatter).length > 0) {
      const frontmatterStr = this.serializeFrontmatter(note.frontmatter);
      newContent = frontmatterStr + '\n' + content + '\n' + note.body;
    } else {
      newContent = content + '\n' + note.content;
    }

    return this.updateNote(relativePath, newContent);
  }

  async deleteNote(
    relativePath: string,
    options: { permanent?: boolean } = {}
  ): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);

    try {
      if (options.permanent) {
        await fs.unlink(fullPath);
      } else {
        const trashPath = path.join(this.config.path, '.trash', relativePath);
        await fs.mkdir(path.dirname(trashPath), { recursive: true });
        await fs.rename(fullPath, trashPath);
      }
      this.noteCache.delete(relativePath);
      return true;
    } catch {
      return false;
    }
  }

  async moveNote(oldPath: string, newPath: string): Promise<Note> {
    const fullOldPath = this.resolvePath(oldPath);
    const fullNewPath = this.resolvePath(newPath);

    await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
    await fs.rename(fullOldPath, fullNewPath);
    this.noteCache.delete(oldPath);

    const note = await this.readNote(newPath);
    if (!note) throw new Error('Failed to read moved note');
    return note;
  }

  // --------------------------------------------------------------------------
  // Listing Operations
  // --------------------------------------------------------------------------

  async listNotes(options: { folder?: string; recursive?: boolean } = {}): Promise<string[]> {
    const baseDir = options.folder
      ? path.join(this.config.path, options.folder)
      : this.config.path;

    const pattern = options.recursive !== false ? '**/*.md' : '*.md';
    const files = await glob(pattern, {
      cwd: baseDir,
      ignore: ['**/node_modules/**', '**/.obsidian/**', '**/.trash/**'],
    });

    return files.map(f => {
      return options.folder ? path.join(options.folder, f) : f;
    });
  }

  async listFolders(): Promise<string[]> {
    const folders: string[] = [];

    const walk = async (dir: string, base: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const relativePath = path.join(base, entry.name);
          folders.push(relativePath);
          await walk(path.join(dir, entry.name), relativePath);
        }
      }
    };

    await walk(this.config.path, '');
    return folders;
  }

  async listTags(): Promise<Map<string, number>> {
    const tagCounts = new Map<string, number>();
    const notes = await this.listNotes();

    for (const notePath of notes) {
      const note = await this.readNote(notePath);
      if (note) {
        for (const tag of note.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    return tagCounts;
  }

  // --------------------------------------------------------------------------
  // Search Operations
  // --------------------------------------------------------------------------

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const notes = await this.listNotes({
      folder: options.folder,
      recursive: true,
    });

    const flags = options.caseSensitive ? 'g' : 'gi';
    const pattern = options.regex
      ? new RegExp(options.query, flags)
      : new RegExp(this.escapeRegex(options.query), flags);

    for (const notePath of notes) {
      if (options.filePattern && !this.matchGlob(notePath, options.filePattern)) {
        continue;
      }

      const note = await this.readNote(notePath);
      if (!note) continue;

      if (options.tags && options.tags.length > 0) {
        const hasTag = options.tags.some(t => note.tags.includes(t));
        if (!hasTag) continue;
      }

      const matches: SearchMatch[] = [];
      const lines = note.content.split('\n');

      lines.forEach((line, lineNum) => {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(line)) !== null) {
          matches.push({
            line: lineNum + 1,
            column: match.index + 1,
            text: match[0],
            context: line.trim(),
          });
        }
      });

      if (matches.length > 0) {
        results.push({
          note: note.name,
          relativePath: note.relativePath,
          matches,
          score: matches.length,
        });
      }

      if (options.limit && results.length >= options.limit) {
        break;
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  async findByTitle(query: string, fuzzy: boolean = false): Promise<string[]> {
    const notes = await this.listNotes();
    const lowerQuery = query.toLowerCase();

    return notes.filter(notePath => {
      const name = path.basename(notePath, '.md').toLowerCase();
      if (fuzzy) {
        return this.fuzzyMatch(name, lowerQuery);
      }
      return name.includes(lowerQuery);
    });
  }

  async findByTag(tag: string): Promise<string[]> {
    const results: string[] = [];
    const notes = await this.listNotes();
    const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;

    for (const notePath of notes) {
      const note = await this.readNote(notePath);
      if (note && note.tags.includes(normalizedTag)) {
        results.push(notePath);
      }
    }

    return results;
  }

  async getBacklinks(relativePath: string): Promise<string[]> {
    const backlinks: string[] = [];
    const targetName = path.basename(relativePath, '.md');
    const notes = await this.listNotes();

    for (const notePath of notes) {
      if (notePath === relativePath) continue;

      const note = await this.readNote(notePath);
      if (!note) continue;

      const hasLink = note.links.some(
        link =>
          link.target === targetName ||
          link.target === relativePath ||
          link.target === relativePath.replace('.md', '')
      );

      if (hasLink) {
        backlinks.push(notePath);
      }
    }

    return backlinks;
  }

  // --------------------------------------------------------------------------
  // Daily Notes
  // --------------------------------------------------------------------------

  async dailyNote(options: DailyNoteOptions = {}): Promise<Note> {
    const date = options.date || new Date();
    const filename = this.formatDate(date, this.config.dailyNotesFormat || 'YYYY-MM-DD');
    const relativePath = path.join(
      this.config.dailyNotesFolder || 'Daily Notes',
      filename + '.md'
    );

    const existing = await this.readNote(relativePath);
    if (existing) {
      return existing;
    }

    let content = '# ' + filename + '\n\n';

    if (options.template) {
      content = await this.applyTemplate(options.template, {
        title: filename,
        date: date.toISOString().split('T')[0],
      });
    }

    return this.createNote(relativePath, content);
  }

  async listDailyNotes(): Promise<string[]> {
    return this.listNotes({
      folder: this.config.dailyNotesFolder,
      recursive: false,
    });
  }

  // --------------------------------------------------------------------------
  // Templates
  // --------------------------------------------------------------------------

  async listTemplates(): Promise<string[]> {
    try {
      return await this.listNotes({
        folder: this.config.templatesFolder,
        recursive: true,
      });
    } catch {
      return [];
    }
  }

  async applyTemplate(
    templateName: string,
    variables: Record<string, string> = {}
  ): Promise<string> {
    const templatePath = path.join(
      this.config.templatesFolder || 'Templates',
      templateName.endsWith('.md') ? templateName : templateName + '.md'
    );

    const template = await this.readNote(templatePath);
    if (!template) {
      throw new Error('Template not found: ' + templateName);
    }

    let content = template.content;

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp('\{\{\s*' + key + '\s*\}\}', 'g');
      content = content.replace(pattern, value);
    }

    content = content.replace(/\{\{\s*date\s*\}\}/g, new Date().toISOString().split('T')[0]);
    content = content.replace(/\{\{\s*time\s*\}\}/g, new Date().toTimeString().split(' ')[0]);

    return content;
  }

  // --------------------------------------------------------------------------
  // Frontmatter Operations
  // --------------------------------------------------------------------------

  async getFrontmatter(relativePath: string): Promise<Record<string, unknown> | null> {
    const note = await this.readNote(relativePath);
    return note?.frontmatter || null;
  }

  async updateFrontmatter(
    relativePath: string,
    key: string,
    value: unknown
  ): Promise<Note> {
    const note = await this.readNote(relativePath);
    if (!note) {
      throw new Error('Note not found: ' + relativePath);
    }

    const newFrontmatter = { ...note.frontmatter, [key]: value };
    const frontmatterStr = this.serializeFrontmatter(newFrontmatter);
    const newContent = frontmatterStr + '\n' + note.body;

    return this.updateNote(relativePath, newContent);
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private resolvePath(relativePath: string): string {
    const normalized = relativePath.endsWith('.md') ? relativePath : relativePath + '.md';
    return path.join(this.config.path, normalized);
  }

  private parseNote(fullPath: string, content: string): Note {
    const relativePath = path.relative(this.config.path, fullPath);
    const name = path.basename(fullPath, '.md');

    const { frontmatter, body } = this.parseFrontmatter(content);
    const tags = this.extractTags(content, frontmatter);
    const links = this.extractLinks(content);

    return {
      path: fullPath,
      relativePath,
      name,
      content,
      frontmatter,
      body,
      tags,
      links,
      backlinks: [],
    };
  }

  private parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1];
    const body = content.slice(match[0].length);

    const frontmatter: Record<string, unknown> = {};
    const lines = frontmatterStr.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();

        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim().replace(/^["']|["']$/g, ''));
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (!isNaN(Number(value)) && value !== '') {
          value = Number(value);
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, body };
  }

  private serializeFrontmatter(frontmatter: Record<string, unknown>): string {
    const lines = ['---'];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        lines.push(key + ': [' + value.join(', ') + ']');
      } else {
        lines.push(key + ': ' + value);
      }
    }

    lines.push('---');
    return lines.join('\n');
  }

  private extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
    const tags = new Set<string>();

    if (frontmatter.tags) {
      const fmTags = Array.isArray(frontmatter.tags)
        ? frontmatter.tags
        : [frontmatter.tags];
      fmTags.forEach(t => tags.add(String(t)));
    }

    const tagPattern = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      tags.add(match[1]);
    }

    return Array.from(tags);
  }

  private extractLinks(content: string): NoteLink[] {
    const links: NoteLink[] = [];
    const lines = content.split('\n');

    lines.forEach((line, lineNum) => {
      const wikiPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      let match;
      while ((match = wikiPattern.exec(line)) !== null) {
        links.push({
          target: match[1],
          display: match[2],
          type: 'wikilink',
          line: lineNum + 1,
        });
      }

      const mdPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
      while ((match = mdPattern.exec(line)) !== null) {
        links.push({
          target: match[2],
          display: match[1],
          type: 'markdown',
          line: lineNum + 1,
        });
      }
    });

    return links;
  }

  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private fuzzyMatch(str: string, pattern: string): boolean {
    let patternIdx = 0;
    for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
      if (str[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }
    return patternIdx === pattern.length;
  }

  private matchGlob(filepath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp('^' + regexPattern + '$').test(filepath);
  }
}

// ============================================================================
// Vault Manager (Multi-vault support)
// ============================================================================

export class VaultManager {
  private vaults: Map<string, Vault> = new Map();
  private activeVault: Vault | null = null;

  async open(vaultPath: string, options: Partial<VaultConfig> = {}): Promise<Vault> {
    const resolvedPath = path.resolve(vaultPath);

    if (this.vaults.has(resolvedPath)) {
      this.activeVault = this.vaults.get(resolvedPath)!;
      return this.activeVault;
    }

    const vault = new Vault(resolvedPath, options);

    if (!(await vault.exists())) {
      throw new Error('Vault path does not exist: ' + resolvedPath);
    }

    this.vaults.set(resolvedPath, vault);
    this.activeVault = vault;

    return vault;
  }

  getActive(): Vault | null {
    return this.activeVault;
  }

  listOpened(): Vault[] {
    return Array.from(this.vaults.values());
  }

  close(vaultPath: string): boolean {
    const resolvedPath = path.resolve(vaultPath);
    const vault = this.vaults.get(resolvedPath);

    if (!vault) return false;

    this.vaults.delete(resolvedPath);

    if (this.activeVault === vault) {
      const values = Array.from(this.vaults.values());
      this.activeVault = values.length > 0 ? values[0] : null;
    }

    return true;
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

export const vaultManager = new VaultManager();

// ============================================================================
// Convenience exports
// ============================================================================

export async function openVault(vaultPath: string): Promise<Vault> {
  return vaultManager.open(vaultPath);
}

export function getActiveVault(): Vault | null {
  return vaultManager.getActive();
}
