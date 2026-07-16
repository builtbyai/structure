/**
 * Skills System
 *
 * Extensible skill system inspired by Claude Code's skills architecture.
 * Skills are packaged workflows defined in SKILL.md files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Skill definition
export interface Skill {
  name: string;
  description: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  context?: 'fork' | 'inline';
  agent?: string;
  content: string;
  path: string;
}

// Skill frontmatter
export interface SkillFrontmatter {
  name: string;
  description: string;
  'disable-model-invocation'?: boolean;
  'user-invocable'?: boolean;
  'allowed-tools'?: string;
  context?: 'fork' | 'inline';
  agent?: string;
}

// Skill registry
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private searchPaths: string[];

  constructor(searchPaths: string[]) {
    this.searchPaths = searchPaths;
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
        if (entry.isDirectory()) {
          const skillPath = path.join(basePath, entry.name, 'SKILL.md');
          try {
            const skill = await this.parseSkillFile(skillPath);
            if (skill) {
              this.skills.set(skill.name, skill);
            }
          } catch {
            // Skip invalid skill files
          }
        }
      }
    } catch {
      // Path doesn't exist, skip
    }
  }

  private async parseSkillFile(filePath: string): Promise<Skill | null> {
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = yaml.load(frontmatterMatch[1]) as SkillFrontmatter;
    const body = frontmatterMatch[2].trim();

    if (!frontmatter.name || !frontmatter.description) {
      return null;
    }

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      disableModelInvocation: frontmatter['disable-model-invocation'],
      userInvocable: frontmatter['user-invocable'] !== false,
      allowedTools: Array.isArray(frontmatter['allowed-tools'])
        ? frontmatter['allowed-tools'].map((t: string) => t.trim())
        : frontmatter['allowed-tools']?.split(',').map((t: string) => t.trim()),
      context: frontmatter.context,
      agent: frontmatter.agent,
      content: body,
      path: filePath,
    };
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  listUserInvocable(): Skill[] {
    return this.list().filter(s => s.userInvocable !== false);
  }

  async invoke(name: string, args: string[] = []): Promise<string> {
    const skill = this.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    // Substitute arguments
    let content = skill.content;
    content = content.replace(/\$ARGUMENTS/g, args.join(' '));
    args.forEach((arg, i) => {
      content = content.replace(new RegExp(`\\$${i}`, 'g'), arg);
      content = content.replace(new RegExp(`\\$ARGUMENTS\\[${i}\\]`, 'g'), arg);
    });

    return content;
  }
}

// Initialize skills from standard paths + configured extra paths
export async function initSkills(
  projectDir: string,
  extraPaths: string[] = []
): Promise<SkillRegistry> {
  const homedir = process.env.HOME || process.env.USERPROFILE || '';

  // Also check STRUCTURE_SKILL_PATHS env var (semicolon-separated on Windows, colon on Unix)
  const envPaths = process.env.STRUCTURE_SKILL_PATHS
    ? process.env.STRUCTURE_SKILL_PATHS.split(process.platform === 'win32' ? ';' : ':')
        .map(p => p.trim())
        .filter(Boolean)
    : [];

  const searchPaths = [
    // Project .claude/skills (highest priority — Claude Code native)
    path.join(projectDir, '.claude', 'skills'),
    // Project .structure/skills
    path.join(projectDir, '.structure', 'skills'),
    // User global skills (PC-wide)
    path.join(homedir, '.structure', 'skills'),
    // Config-driven extra paths (network shares, team directories, etc.)
    ...extraPaths,
    // Environment variable paths (lowest priority)
    ...envPaths,
  ];

  const registry = new SkillRegistry(searchPaths);
  await registry.load();
  return registry;
}
