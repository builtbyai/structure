/**
 * Advanced Vault Commands
 *
 * Powerful query and manipulation tools for Obsidian vaults:
 * - Advanced search with filters, regex, output formatting
 * - Bulk operations: batch rename, property updates, mass tagging
 * - Reporting: vault statistics, task summaries, link analysis
 * - Graph analysis: orphans, dead-ends, broken links, unresolved references
 * - Content extraction: export tasks, extract headings, pull specific content
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Vault, SearchResult, Note, NoteLink } from '../../vault/index.js';
import { getVault } from './index.js';

// ============================================================================
// Types for Advanced Operations
// ============================================================================

interface TaskItem {
  text: string;
  completed: boolean;
  line: number;
  file: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  tags: string[];
}

interface HeadingItem {
  text: string;
  level: number;
  line: number;
  file: string;
}

interface LinkAnalysis {
  file: string;
  outgoingLinks: NoteLink[];
  incomingLinks: string[];
  unresolvedLinks: string[];
}

interface VaultReport {
  timestamp: string;
  noteCount: number;
  folderCount: number;
  tagCount: number;
  totalSize: number;
  avgNoteSize: number;
  taskStats: {
    total: number;
    completed: number;
    pending: number;
  };
  linkStats: {
    total: number;
    internal: number;
    broken: number;
  };
  topTags: Array<{ tag: string; count: number }>;
  recentlyModified: string[];
  oldestNotes: string[];
  largestNotes: Array<{ file: string; size: number }>;
}

// ============================================================================
// Advanced Search Tools
// ============================================================================

export function advancedSearchCommands(program: Command): void {
  // Advanced search with filters
  program
    .command('search:advanced')
    .description('Advanced search with multiple filters and output options')
    .requiredOption('-q, --query <query>', 'Search query (supports regex with --regex)')
    .option('-p, --path <folder>', 'Limit to folder path')
    .option('-t, --tag <tags>', 'Filter by tags (comma-separated)')
    .option('-e, --ext <extension>', 'File extension filter', '.md')
    .option('--created-after <date>', 'Created after date (YYYY-MM-DD)')
    .option('--created-before <date>', 'Created before date (YYYY-MM-DD)')
    .option('--modified-after <date>', 'Modified after date (YYYY-MM-DD)')
    .option('--modified-before <date>', 'Modified before date (YYYY-MM-DD)')
    .option('--has-frontmatter <key>', 'Must have frontmatter key')
    .option('--frontmatter <key=value>', 'Match frontmatter key=value')
    .option('-l, --limit <n>', 'Max results', '50')
    .option('--regex', 'Use regex pattern')
    .option('--case', 'Case sensitive')
    .option('-c, --context <lines>', 'Lines of context around match', '1')
    .option('--format <format>', 'Output: text, json, csv, paths', 'text')
    .option('--sort <by>', 'Sort: relevance, date, name, size', 'relevance')
    .option('--reverse', 'Reverse sort order')
    .option('--count-only', 'Return match count only')
    .action(async (options) => {
      const vault = getVault();

      // Parse tags
      const tags = options.tag ? options.tag.split(',').map((t: string) => t.trim()) : undefined;

      // Perform search
      let results = await vault.search({
        query: options.query,
        folder: options.path,
        tags,
        limit: parseInt(options.limit, 10),
        regex: options.regex,
        caseSensitive: options.case,
      });

      // Apply date filters
      if (options.createdAfter || options.createdBefore || options.modifiedAfter || options.modifiedBefore) {
        const createdAfter = options.createdAfter ? new Date(options.createdAfter) : null;
        const createdBefore = options.createdBefore ? new Date(options.createdBefore) : null;
        const modifiedAfter = options.modifiedAfter ? new Date(options.modifiedAfter) : null;
        const modifiedBefore = options.modifiedBefore ? new Date(options.modifiedBefore) : null;

        const filteredResults: SearchResult[] = [];
        for (const result of results) {
          const note = await vault.readNote(result.relativePath);
          if (!note) continue;

          let include = true;
          if (createdAfter && note.created && note.created < createdAfter) include = false;
          if (createdBefore && note.created && note.created > createdBefore) include = false;
          if (modifiedAfter && note.modified && note.modified < modifiedAfter) include = false;
          if (modifiedBefore && note.modified && note.modified > modifiedBefore) include = false;

          if (include) filteredResults.push(result);
        }
        results = filteredResults;
      }

      // Apply frontmatter filters
      if (options.hasFrontmatter || options.frontmatter) {
        const filteredResults: SearchResult[] = [];
        for (const result of results) {
          const note = await vault.readNote(result.relativePath);
          if (!note) continue;

          let include = true;
          if (options.hasFrontmatter && !(options.hasFrontmatter in note.frontmatter)) {
            include = false;
          }
          if (options.frontmatter) {
            const [key, value] = options.frontmatter.split('=');
            if (note.frontmatter[key] !== value) include = false;
          }

          if (include) filteredResults.push(result);
        }
        results = filteredResults;
      }

      // Sort results
      if (options.sort === 'name') {
        results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      } else if (options.sort === 'date') {
        // Already sorted by search, would need note metadata
      }
      if (options.reverse) results.reverse();

      // Output
      if (options.countOnly) {
        const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
        console.log(`Files: ${results.length}, Matches: ${totalMatches}`);
        return;
      }

      outputResults(results, options.format, parseInt(options.context, 10));
    });

  // Search and replace (preview mode)
  program
    .command('search:replace')
    .description('Search and replace across vault (preview by default)')
    .requiredOption('-s, --search <pattern>', 'Search pattern')
    .requiredOption('-r, --replace <replacement>', 'Replacement string')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--regex', 'Use regex pattern')
    .option('--case', 'Case sensitive')
    .option('--execute', 'Actually perform replacement (default is preview)')
    .option('--backup', 'Create backup before replacing')
    .action(async (options) => {
      const vault = getVault();

      const results = await vault.search({
        query: options.search,
        folder: options.path,
        regex: options.regex,
        caseSensitive: options.case,
      });

      if (results.length === 0) {
        console.log(chalk.yellow('No matches found.'));
        return;
      }

      const flags = options.case ? 'g' : 'gi';
      const pattern = options.regex
        ? new RegExp(options.search, flags)
        : new RegExp(escapeRegex(options.search), flags);

      console.log(chalk.bold(`\n${options.execute ? 'Replacing' : 'Preview'} in ${results.length} files:\n`));

      for (const result of results) {
        const note = await vault.readNote(result.relativePath);
        if (!note) continue;

        const newContent = note.content.replace(pattern, options.replace);
        const changes = countReplacements(note.content, newContent);

        console.log(chalk.cyan(result.relativePath) + chalk.gray(` (${changes} replacements)`));

        if (options.execute) {
          if (options.backup) {
            const backupPath = result.relativePath + '.bak';
            await fs.writeFile(
              path.join(vault.vaultPath, backupPath),
              note.content,
              'utf-8'
            );
          }
          await vault.updateNote(result.relativePath, newContent);
          console.log(chalk.green('  Updated'));
        } else {
          // Show preview of changes
          result.matches.slice(0, 3).forEach(match => {
            const before = match.context;
            const after = before.replace(pattern, chalk.green(options.replace));
            console.log(chalk.gray('  L' + match.line + ':'));
            console.log(chalk.red('    - ' + before));
            console.log(chalk.green('    + ' + after));
          });
        }
      }

      if (!options.execute) {
        console.log(chalk.yellow('\nRun with --execute to apply changes.'));
      }
    });

  // Fuzzy search
  program
    .command('search:fuzzy <query>')
    .description('Fuzzy search across note titles and content')
    .option('-l, --limit <n>', 'Max results', '20')
    .option('--titles-only', 'Search titles only')
    .option('--format <format>', 'Output: text, json, paths', 'text')
    .action(async (query, options) => {
      const vault = getVault();

      // Fuzzy title search
      const titleMatches = await vault.findByTitle(query, true);

      if (options.titlesOnly) {
        if (options.format === 'json') {
          console.log(JSON.stringify(titleMatches, null, 2));
        } else if (options.format === 'paths') {
          titleMatches.forEach(m => console.log(m));
        } else {
          console.log(chalk.bold(`\nFuzzy matches for "${query}" (${titleMatches.length}):`));
          titleMatches.slice(0, parseInt(options.limit, 10)).forEach(m => {
            console.log('  ' + chalk.cyan(m));
          });
        }
        return;
      }

      // Also search content
      const contentResults = await vault.search({
        query,
        limit: parseInt(options.limit, 10),
      });

      // Combine and deduplicate
      const allPaths = new Set([...titleMatches, ...contentResults.map(r => r.relativePath)]);

      if (options.format === 'json') {
        console.log(JSON.stringify({
          titleMatches,
          contentMatches: contentResults,
        }, null, 2));
      } else {
        console.log(chalk.bold(`\nFuzzy matches for "${query}" (${allPaths.size} files):`));
        Array.from(allPaths).slice(0, parseInt(options.limit, 10)).forEach(p => {
          const isTitle = titleMatches.includes(p);
          const isContent = contentResults.some(r => r.relativePath === p);
          const badge = isTitle && isContent ? '[T+C]' : isTitle ? '[T]' : '[C]';
          console.log('  ' + chalk.gray(badge) + ' ' + chalk.cyan(p));
        });
      }
    });
}

// ============================================================================
// Bulk Operations
// ============================================================================

export function bulkOperationsCommands(program: Command): void {
  // Batch rename
  program
    .command('bulk:rename')
    .description('Batch rename notes using pattern')
    .requiredOption('--pattern <pattern>', 'Match pattern (glob or regex with --regex)')
    .requiredOption('--replace <replacement>', 'Replacement pattern ($1, $2 for groups)')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--regex', 'Use regex pattern')
    .option('--execute', 'Actually perform rename (default is preview)')
    .option('--update-links', 'Update internal links to renamed files')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const renames: Array<{ from: string; to: string }> = [];

      for (const notePath of notes) {
        const filename = path.basename(notePath, '.md');
        const dir = path.dirname(notePath);

        let newFilename: string;
        if (options.regex) {
          const regex = new RegExp(options.pattern);
          if (!regex.test(filename)) continue;
          newFilename = filename.replace(regex, options.replace);
        } else {
          // Glob-style pattern to regex
          const globRegex = globToRegex(options.pattern);
          if (!globRegex.test(filename)) continue;
          newFilename = filename.replace(globRegex, options.replace);
        }

        if (newFilename !== filename) {
          const newPath = path.join(dir, newFilename + '.md');
          renames.push({ from: notePath, to: newPath });
        }
      }

      if (renames.length === 0) {
        console.log(chalk.yellow('No files match the pattern.'));
        return;
      }

      console.log(chalk.bold(`\n${options.execute ? 'Renaming' : 'Preview rename'} ${renames.length} files:\n`));

      for (const { from, to } of renames) {
        console.log(`  ${chalk.red(from)} -> ${chalk.green(to)}`);

        if (options.execute) {
          await vault.moveNote(from, to);

          if (options.updateLinks) {
            // Update links in other files
            const oldName = path.basename(from, '.md');
            const newName = path.basename(to, '.md');
            await updateLinksToFile(vault, oldName, newName);
          }
        }
      }

      if (!options.execute) {
        console.log(chalk.yellow('\nRun with --execute to apply changes.'));
      }
    });

  // Bulk property update
  program
    .command('bulk:property')
    .description('Bulk update frontmatter properties')
    .requiredOption('-k, --key <key>', 'Property key to set')
    .requiredOption('-v, --value <value>', 'Property value')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('--pattern <pattern>', 'Filter by filename pattern')
    .option('--has-property <key>', 'Only notes with existing property')
    .option('--missing-property <key>', 'Only notes missing property')
    .option('--execute', 'Actually update (default is preview)')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const updates: string[] = [];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        // Apply filters
        if (options.tag && !note.tags.includes(options.tag)) continue;
        if (options.pattern && !new RegExp(options.pattern).test(notePath)) continue;
        if (options.hasProperty && !(options.hasProperty in note.frontmatter)) continue;
        if (options.missingProperty && options.missingProperty in note.frontmatter) continue;

        updates.push(notePath);
      }

      if (updates.length === 0) {
        console.log(chalk.yellow('No files match the criteria.'));
        return;
      }

      console.log(chalk.bold(`\n${options.execute ? 'Updating' : 'Preview update'} ${updates.length} files:`));
      console.log(chalk.gray(`  Setting ${options.key} = ${options.value}\n`));

      for (const notePath of updates) {
        console.log('  ' + chalk.cyan(notePath));

        if (options.execute) {
          // Parse value (support arrays, booleans, numbers)
          let value: unknown = options.value;
          if (options.value.startsWith('[') && options.value.endsWith(']')) {
            value = options.value.slice(1, -1).split(',').map((v: string) => v.trim());
          } else if (options.value === 'true') {
            value = true;
          } else if (options.value === 'false') {
            value = false;
          } else if (!isNaN(Number(options.value))) {
            value = Number(options.value);
          }

          await vault.updateFrontmatter(notePath, options.key, value);
        }
      }

      if (!options.execute) {
        console.log(chalk.yellow('\nRun with --execute to apply changes.'));
      }
    });

  // Mass tagging
  program
    .command('bulk:tag')
    .description('Add or remove tags from multiple notes')
    .requiredOption('--add <tags>', 'Tags to add (comma-separated)', '')
    .option('--remove <tags>', 'Tags to remove (comma-separated)', '')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--pattern <pattern>', 'Filter by filename pattern')
    .option('-q, --query <query>', 'Filter by content search')
    .option('--execute', 'Actually update (default is preview)')
    .action(async (options) => {
      const vault = getVault();

      let notes: string[];
      if (options.query) {
        const results = await vault.search({ query: options.query, folder: options.path });
        notes = results.map(r => r.relativePath);
      } else {
        notes = await vault.listNotes({ folder: options.path });
      }

      const addTags = options.add ? options.add.split(',').map((t: string) => t.trim().replace(/^#/, '')) : [];
      const removeTags = options.remove ? options.remove.split(',').map((t: string) => t.trim().replace(/^#/, '')) : [];

      if (addTags.length === 0 && removeTags.length === 0) {
        console.log(chalk.red('Specify --add or --remove tags.'));
        return;
      }

      const updates: Array<{ file: string; add: string[]; remove: string[] }> = [];

      for (const notePath of notes) {
        if (options.pattern && !new RegExp(options.pattern).test(notePath)) continue;

        const note = await vault.readNote(notePath);
        if (!note) continue;

        const toAdd = addTags.filter((t: string) => !note.tags.includes(t));
        const toRemove = removeTags.filter((t: string) => note.tags.includes(t));

        if (toAdd.length > 0 || toRemove.length > 0) {
          updates.push({ file: notePath, add: toAdd, remove: toRemove });
        }
      }

      if (updates.length === 0) {
        console.log(chalk.yellow('No changes needed.'));
        return;
      }

      console.log(chalk.bold(`\n${options.execute ? 'Updating' : 'Preview update'} ${updates.length} files:\n`));

      for (const { file, add, remove } of updates) {
        console.log('  ' + chalk.cyan(file));
        if (add.length > 0) console.log(chalk.green('    + ' + add.map(t => '#' + t).join(' ')));
        if (remove.length > 0) console.log(chalk.red('    - ' + remove.map(t => '#' + t).join(' ')));

        if (options.execute) {
          const note = await vault.readNote(file);
          if (!note) continue;

          // Update frontmatter tags
          let fmTags = Array.isArray(note.frontmatter.tags)
            ? [...note.frontmatter.tags]
            : note.frontmatter.tags
            ? [String(note.frontmatter.tags)]
            : [];

          fmTags = fmTags.filter(t => !remove.includes(t));
          fmTags.push(...add);
          fmTags = [...new Set(fmTags)]; // Deduplicate

          await vault.updateFrontmatter(file, 'tags', fmTags);
        }
      }

      if (!options.execute) {
        console.log(chalk.yellow('\nRun with --execute to apply changes.'));
      }
    });

  // Bulk move
  program
    .command('bulk:move')
    .description('Move multiple notes to a new folder')
    .requiredOption('--to <folder>', 'Destination folder')
    .option('--from <folder>', 'Source folder')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('--pattern <pattern>', 'Filter by filename pattern')
    .option('--flatten', 'Flatten to single folder (ignore subdirectories)')
    .option('--execute', 'Actually move (default is preview)')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.from });

      const moves: Array<{ from: string; to: string }> = [];

      for (const notePath of notes) {
        if (options.pattern && !new RegExp(options.pattern).test(notePath)) continue;

        if (options.tag) {
          const note = await vault.readNote(notePath);
          if (!note || !note.tags.includes(options.tag)) continue;
        }

        const filename = path.basename(notePath);
        let newPath: string;

        if (options.flatten) {
          newPath = path.join(options.to, filename);
        } else {
          const relativePath = options.from
            ? notePath.replace(options.from + '/', '')
            : notePath;
          newPath = path.join(options.to, relativePath);
        }

        if (newPath !== notePath) {
          moves.push({ from: notePath, to: newPath });
        }
      }

      if (moves.length === 0) {
        console.log(chalk.yellow('No files to move.'));
        return;
      }

      console.log(chalk.bold(`\n${options.execute ? 'Moving' : 'Preview move'} ${moves.length} files:\n`));

      for (const { from, to } of moves) {
        console.log(`  ${chalk.red(from)} -> ${chalk.green(to)}`);

        if (options.execute) {
          await vault.moveNote(from, to);
        }
      }

      if (!options.execute) {
        console.log(chalk.yellow('\nRun with --execute to apply changes.'));
      }
    });
}

// ============================================================================
// Reporting Tools
// ============================================================================

export function reportingCommands(program: Command): void {
  // Comprehensive vault statistics
  program
    .command('report:stats')
    .description('Generate comprehensive vault statistics report')
    .option('--format <format>', 'Output: text, json, markdown', 'text')
    .option('-o, --output <file>', 'Save report to file')
    .action(async (options) => {
      const vault = getVault();

      console.log(chalk.gray('Analyzing vault...'));

      const notes = await vault.listNotes();
      const folders = await vault.listFolders();
      const tagCounts = await vault.listTags();

      // Gather detailed statistics
      let totalSize = 0;
      let totalTasks = 0;
      let completedTasks = 0;
      let totalLinks = 0;
      let brokenLinks = 0;
      const noteSizes: Array<{ file: string; size: number }> = [];
      const noteModified: Array<{ file: string; date: Date }> = [];

      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        totalSize += note.content.length;
        noteSizes.push({ file: notePath, size: note.content.length });

        if (note.modified) {
          noteModified.push({ file: notePath, date: note.modified });
        }

        // Count tasks
        const taskMatches = note.content.match(/- \[([ xX])\]/g) || [];
        totalTasks += taskMatches.length;
        completedTasks += taskMatches.filter(t => t.includes('x') || t.includes('X')).length;

        // Count links
        totalLinks += note.links.length;
        for (const link of note.links) {
          if (!allNoteNames.has(link.target) && !allNoteNames.has(link.target.replace('.md', ''))) {
            brokenLinks++;
          }
        }
      }

      // Sort for top lists
      noteSizes.sort((a, b) => b.size - a.size);
      noteModified.sort((a, b) => b.date.getTime() - a.date.getTime());

      const topTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      const report: VaultReport = {
        timestamp: new Date().toISOString(),
        noteCount: notes.length,
        folderCount: folders.length,
        tagCount: tagCounts.size,
        totalSize,
        avgNoteSize: notes.length > 0 ? Math.round(totalSize / notes.length) : 0,
        taskStats: {
          total: totalTasks,
          completed: completedTasks,
          pending: totalTasks - completedTasks,
        },
        linkStats: {
          total: totalLinks,
          internal: totalLinks,
          broken: brokenLinks,
        },
        topTags,
        recentlyModified: noteModified.slice(0, 10).map(n => n.file),
        oldestNotes: noteModified.slice(-10).reverse().map(n => n.file),
        largestNotes: noteSizes.slice(0, 10),
      };

      // Output
      if (options.format === 'json') {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          await fs.writeFile(options.output, output, 'utf-8');
          console.log(chalk.green('Report saved to ' + options.output));
        } else {
          console.log(output);
        }
      } else if (options.format === 'markdown') {
        const md = generateMarkdownReport(report);
        if (options.output) {
          await fs.writeFile(options.output, md, 'utf-8');
          console.log(chalk.green('Report saved to ' + options.output));
        } else {
          console.log(md);
        }
      } else {
        printTextReport(report);
      }
    });

  // Task summary report
  program
    .command('report:tasks')
    .description('Generate task summary report')
    .option('--status <status>', 'Filter: pending, completed, all', 'all')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--due', 'Show only tasks with due dates')
    .option('--overdue', 'Show only overdue tasks')
    .option('--format <format>', 'Output: text, json, csv', 'text')
    .option('--group-by <by>', 'Group: file, tag, priority, date', 'file')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const tasks: TaskItem[] = [];
      const today = new Date().toISOString().split('T')[0];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        const lines = note.content.split('\n');
        lines.forEach((line, idx) => {
          const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+)/);
          if (!taskMatch) return;

          const completed = taskMatch[2].toLowerCase() === 'x';
          let text = taskMatch[3];

          // Skip based on status filter
          if (options.status === 'pending' && completed) return;
          if (options.status === 'completed' && !completed) return;

          // Extract metadata
          let priority: 'high' | 'medium' | 'low' | undefined;
          let dueDate: string | undefined;
          const tags: string[] = [];

          // Priority (⏫ ⬇️ or [!], [!!], [!!!])
          if (text.includes('⏫') || text.includes('[!!!]')) priority = 'high';
          else if (text.includes('⬇️') || text.includes('[!]')) priority = 'low';

          // Due date 📅 YYYY-MM-DD or due:YYYY-MM-DD
          const dueMatch = text.match(/(?:📅\s*|due:\s*)(\d{4}-\d{2}-\d{2})/i);
          if (dueMatch) dueDate = dueMatch[1];

          // Tags
          const tagMatches = text.matchAll(/#([a-zA-Z][a-zA-Z0-9_/-]*)/g);
          for (const match of tagMatches) {
            tags.push(match[1]);
          }

          // Filter by due/overdue
          if (options.due && !dueDate) return;
          if (options.overdue && (!dueDate || dueDate >= today)) return;

          tasks.push({
            text: text.trim(),
            completed,
            line: idx + 1,
            file: notePath,
            priority,
            dueDate,
            tags,
          });
        });
      }

      // Output
      if (options.format === 'json') {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      if (options.format === 'csv') {
        console.log('file,line,status,priority,due,text');
        tasks.forEach(t => {
          const status = t.completed ? 'completed' : 'pending';
          const escaped = t.text.replace(/"/g, '""');
          console.log(`"${t.file}",${t.line},${status},${t.priority || ''},${t.dueDate || ''},"${escaped}"`);
        });
        return;
      }

      // Text output grouped
      console.log(chalk.bold(`\nTasks (${tasks.length}):\n`));

      if (options.groupBy === 'file') {
        const grouped = groupBy(tasks, t => t.file);
        for (const [file, fileTasks] of Object.entries(grouped)) {
          console.log(chalk.cyan(file) + chalk.gray(` (${fileTasks.length})`));
          fileTasks.forEach(t => {
            const status = t.completed ? chalk.green('[x]') : chalk.yellow('[ ]');
            const due = t.dueDate ? chalk.gray(` 📅 ${t.dueDate}`) : '';
            console.log(`  ${status} ${t.text}${due}`);
          });
          console.log();
        }
      } else if (options.groupBy === 'priority') {
        const priorities: Array<'high' | 'medium' | 'low' | undefined> = ['high', 'medium', 'low', undefined];
        for (const p of priorities) {
          const pTasks = tasks.filter(t => t.priority === p);
          if (pTasks.length === 0) continue;

          const label = p ? p.toUpperCase() : 'NORMAL';
          console.log(chalk.bold(label) + chalk.gray(` (${pTasks.length})`));
          pTasks.forEach(t => {
            const status = t.completed ? chalk.green('[x]') : chalk.yellow('[ ]');
            console.log(`  ${status} ${t.text} ${chalk.gray(t.file)}`);
          });
          console.log();
        }
      } else {
        tasks.forEach(t => {
          const status = t.completed ? chalk.green('[x]') : chalk.yellow('[ ]');
          const due = t.dueDate ? chalk.gray(` 📅 ${t.dueDate}`) : '';
          console.log(`${status} ${t.text}${due} ${chalk.gray('(' + t.file + ':' + t.line + ')')}`);
        });
      }
    });

  // Tag counts report
  program
    .command('report:tags')
    .description('Detailed tag usage report')
    .option('--min <count>', 'Minimum usage count', '1')
    .option('--format <format>', 'Output: text, json, csv', 'text')
    .option('--hierarchy', 'Show nested tag hierarchy')
    .action(async (options) => {
      const vault = getVault();
      const tagCounts = await vault.listTags();

      const minCount = parseInt(options.min, 10);
      const filtered = Array.from(tagCounts.entries())
        .filter(([_, count]) => count >= minCount)
        .sort((a, b) => b[1] - a[1]);

      if (options.format === 'json') {
        console.log(JSON.stringify(Object.fromEntries(filtered), null, 2));
        return;
      }

      if (options.format === 'csv') {
        console.log('tag,count');
        filtered.forEach(([tag, count]) => console.log(`${tag},${count}`));
        return;
      }

      console.log(chalk.bold(`\nTags (${filtered.length}):\n`));

      if (options.hierarchy) {
        // Build hierarchy
        const tree: Record<string, { count: number; children: Record<string, number> }> = {};

        for (const [tag, count] of filtered) {
          const parts = tag.split('/');
          const root = parts[0];

          if (!tree[root]) tree[root] = { count: 0, children: {} };

          if (parts.length === 1) {
            tree[root].count += count;
          } else {
            const child = parts.slice(1).join('/');
            tree[root].children[child] = (tree[root].children[child] || 0) + count;
          }
        }

        for (const [root, data] of Object.entries(tree)) {
          console.log(chalk.cyan('#' + root) + chalk.gray(` (${data.count + Object.values(data.children).reduce((s, c) => s + c, 0)})`));
          for (const [child, count] of Object.entries(data.children)) {
            console.log(chalk.gray('  /' + child + ` (${count})`));
          }
        }
      } else {
        const maxTag = Math.max(...filtered.map(([t]) => t.length));
        filtered.forEach(([tag, count]) => {
          const bar = '█'.repeat(Math.min(count, 30));
          console.log(`  #${tag.padEnd(maxTag)} ${chalk.gray(String(count).padStart(4))} ${chalk.blue(bar)}`);
        });
      }
    });
}

// ============================================================================
// Graph Analysis Tools
// ============================================================================

export function graphAnalysisCommands(program: Command): void {
  // Find orphan notes (no incoming or outgoing links)
  program
    .command('graph:orphans')
    .description('Find orphan notes (no links to/from other notes)')
    .option('--format <format>', 'Output: text, json, paths', 'text')
    .option('--ignore <folders>', 'Ignore folders (comma-separated)')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes();
      const ignoreFolders = options.ignore ? options.ignore.split(',').map((f: string) => f.trim()) : [];

      const orphans: string[] = [];
      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));

      for (const notePath of notes) {
        // Skip ignored folders
        if (ignoreFolders.some((f: string) => notePath.startsWith(f))) continue;

        const note = await vault.readNote(notePath);
        if (!note) continue;

        // Check outgoing links
        const hasOutgoing = note.links.some(link =>
          allNoteNames.has(link.target) || allNoteNames.has(link.target.replace('.md', ''))
        );

        // Check incoming links
        const noteName = path.basename(notePath, '.md');
        const backlinks = await vault.getBacklinks(notePath);
        const hasIncoming = backlinks.length > 0;

        if (!hasOutgoing && !hasIncoming) {
          orphans.push(notePath);
        }
      }

      outputList('Orphan Notes', orphans, options.format);
    });

  // Find dead-end notes (links out but no incoming)
  program
    .command('graph:deadends')
    .description('Find dead-end notes (have outgoing links but no incoming)')
    .option('--format <format>', 'Output: text, json, paths', 'text')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes();
      const deadends: string[] = [];

      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        // Check outgoing links
        const hasOutgoing = note.links.some(link =>
          allNoteNames.has(link.target) || allNoteNames.has(link.target.replace('.md', ''))
        );

        // Check incoming links
        const backlinks = await vault.getBacklinks(notePath);
        const hasIncoming = backlinks.length > 0;

        if (hasOutgoing && !hasIncoming) {
          deadends.push(notePath);
        }
      }

      outputList('Dead-end Notes', deadends, options.format);
    });

  // Find broken links
  program
    .command('graph:broken')
    .description('Find broken internal links')
    .option('--format <format>', 'Output: text, json, csv', 'text')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes();

      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));
      const allNotePaths = new Set(notes.map(n => n.replace('.md', '')));

      const brokenLinks: Array<{ file: string; link: string; line: number }> = [];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        for (const link of note.links) {
          const target = link.target.replace('.md', '');

          if (!allNoteNames.has(target) && !allNotePaths.has(target)) {
            brokenLinks.push({
              file: notePath,
              link: link.target,
              line: link.line,
            });
          }
        }
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(brokenLinks, null, 2));
        return;
      }

      if (options.format === 'csv') {
        console.log('file,line,broken_link');
        brokenLinks.forEach(b => console.log(`"${b.file}",${b.line},"${b.link}"`));
        return;
      }

      console.log(chalk.bold(`\nBroken Links (${brokenLinks.length}):\n`));

      const grouped = groupBy(brokenLinks, b => b.file);
      for (const [file, links] of Object.entries(grouped)) {
        console.log(chalk.cyan(file));
        links.forEach(b => {
          console.log(`  ${chalk.gray('L' + b.line + ':')} ${chalk.red(b.link)}`);
        });
      }
    });

  // Find unresolved references
  program
    .command('graph:unresolved')
    .description('Find all unresolved [[wikilinks]] and references')
    .option('--format <format>', 'Output: text, json', 'text')
    .option('--create', 'Create stubs for unresolved links')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes();

      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));
      const unresolved = new Map<string, string[]>(); // target -> source files

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        for (const link of note.links) {
          const target = link.target.replace('.md', '');

          if (!allNoteNames.has(target)) {
            if (!unresolved.has(target)) {
              unresolved.set(target, []);
            }
            if (!unresolved.get(target)!.includes(notePath)) {
              unresolved.get(target)!.push(notePath);
            }
          }
        }
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(Object.fromEntries(unresolved), null, 2));
        return;
      }

      console.log(chalk.bold(`\nUnresolved References (${unresolved.size}):\n`));

      const sorted = Array.from(unresolved.entries())
        .sort((a, b) => b[1].length - a[1].length);

      for (const [target, sources] of sorted) {
        console.log(chalk.red('[[' + target + ']]') + chalk.gray(` (${sources.length} references)`));
        sources.slice(0, 3).forEach(s => console.log(chalk.gray('  from: ' + s)));
        if (sources.length > 3) {
          console.log(chalk.gray(`  ... and ${sources.length - 3} more`));
        }

        if (options.create) {
          await vault.createNote(target, `# ${target}\n\n`);
          console.log(chalk.green('  Created: ' + target + '.md'));
        }
      }
    });

  // Link analysis for a specific file
  program
    .command('graph:links <path>')
    .description('Analyze links for a specific note')
    .option('--depth <n>', 'Link depth to traverse', '1')
    .option('--format <format>', 'Output: text, json', 'text')
    .action(async (notePath, options) => {
      const vault = getVault();
      const note = await vault.readNote(notePath);

      if (!note) {
        console.error(chalk.red('Note not found: ' + notePath));
        process.exit(1);
      }

      const notes = await vault.listNotes();
      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));

      const analysis: LinkAnalysis = {
        file: notePath,
        outgoingLinks: note.links,
        incomingLinks: await vault.getBacklinks(notePath),
        unresolvedLinks: note.links
          .filter(l => !allNoteNames.has(l.target.replace('.md', '')))
          .map(l => l.target),
      };

      if (options.format === 'json') {
        console.log(JSON.stringify(analysis, null, 2));
        return;
      }

      console.log(chalk.bold('\nLink Analysis: ' + notePath + '\n'));

      console.log(chalk.cyan('Outgoing Links:') + ` (${analysis.outgoingLinks.length})`);
      analysis.outgoingLinks.forEach(l => {
        const status = allNoteNames.has(l.target.replace('.md', '')) ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} [[${l.target}]] ${chalk.gray('L' + l.line)}`);
      });

      console.log('\n' + chalk.cyan('Incoming Links:') + ` (${analysis.incomingLinks.length})`);
      analysis.incomingLinks.forEach(l => console.log('  ' + l));

      if (analysis.unresolvedLinks.length > 0) {
        console.log('\n' + chalk.red('Unresolved:') + ` (${analysis.unresolvedLinks.length})`);
        analysis.unresolvedLinks.forEach(l => console.log('  ' + l));
      }
    });

  // Generate graph statistics
  program
    .command('graph:stats')
    .description('Generate graph connectivity statistics')
    .option('--format <format>', 'Output: text, json', 'text')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes();

      console.log(chalk.gray('Analyzing graph...'));

      const allNoteNames = new Set(notes.map(n => path.basename(n, '.md')));

      let totalLinks = 0;
      let brokenLinks = 0;
      let orphanCount = 0;
      let deadendCount = 0;
      const linkCounts: number[] = [];
      const backlinkCounts: number[] = [];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        const validLinks = note.links.filter(l =>
          allNoteNames.has(l.target.replace('.md', ''))
        );

        totalLinks += note.links.length;
        brokenLinks += note.links.length - validLinks.length;
        linkCounts.push(note.links.length);

        const backlinks = await vault.getBacklinks(notePath);
        backlinkCounts.push(backlinks.length);

        if (note.links.length === 0 && backlinks.length === 0) orphanCount++;
        if (note.links.length > 0 && backlinks.length === 0) deadendCount++;
      }

      const avgLinks = linkCounts.reduce((a, b) => a + b, 0) / linkCounts.length || 0;
      const avgBacklinks = backlinkCounts.reduce((a, b) => a + b, 0) / backlinkCounts.length || 0;
      const maxLinks = Math.max(...linkCounts, 0);
      const maxBacklinks = Math.max(...backlinkCounts, 0);

      const stats = {
        totalNotes: notes.length,
        totalLinks,
        brokenLinks,
        orphans: orphanCount,
        deadends: deadendCount,
        avgOutgoingLinks: avgLinks.toFixed(2),
        avgIncomingLinks: avgBacklinks.toFixed(2),
        maxOutgoingLinks: maxLinks,
        maxIncomingLinks: maxBacklinks,
        connectivity: ((1 - orphanCount / notes.length) * 100).toFixed(1) + '%',
      };

      if (options.format === 'json') {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log(chalk.bold('\nGraph Statistics:\n'));
      console.log('  Total Notes:        ' + stats.totalNotes);
      console.log('  Total Links:        ' + stats.totalLinks);
      console.log('  Broken Links:       ' + chalk.red(stats.brokenLinks));
      console.log('  Orphan Notes:       ' + chalk.yellow(stats.orphans));
      console.log('  Dead-end Notes:     ' + chalk.yellow(stats.deadends));
      console.log('  Avg Outgoing Links: ' + stats.avgOutgoingLinks);
      console.log('  Avg Incoming Links: ' + stats.avgIncomingLinks);
      console.log('  Max Outgoing Links: ' + stats.maxOutgoingLinks);
      console.log('  Max Incoming Links: ' + stats.maxIncomingLinks);
      console.log('  Connectivity:       ' + chalk.cyan(stats.connectivity));
    });
}

// ============================================================================
// Content Extraction Tools
// ============================================================================

export function contentExtractionCommands(program: Command): void {
  // Export tasks
  program
    .command('extract:tasks')
    .description('Extract all tasks to a file or output')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--status <status>', 'Filter: pending, completed, all', 'pending')
    .option('--format <format>', 'Output: markdown, json, csv, todoist', 'markdown')
    .option('-o, --output <file>', 'Save to file')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const tasks: TaskItem[] = [];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        const lines = note.content.split('\n');
        lines.forEach((line, idx) => {
          const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+)/);
          if (!taskMatch) return;

          const completed = taskMatch[2].toLowerCase() === 'x';

          if (options.status === 'pending' && completed) return;
          if (options.status === 'completed' && !completed) return;

          const text = taskMatch[3];
          let priority: 'high' | 'medium' | 'low' | undefined;
          let dueDate: string | undefined;
          const tags: string[] = [];

          if (text.includes('⏫') || text.includes('[!!!]')) priority = 'high';
          else if (text.includes('⬇️') || text.includes('[!]')) priority = 'low';

          const dueMatch = text.match(/(?:📅\s*|due:\s*)(\d{4}-\d{2}-\d{2})/i);
          if (dueMatch) dueDate = dueMatch[1];

          const tagMatches = text.matchAll(/#([a-zA-Z][a-zA-Z0-9_/-]*)/g);
          for (const match of tagMatches) {
            tags.push(match[1]);
          }

          tasks.push({
            text: text.trim(),
            completed,
            line: idx + 1,
            file: notePath,
            priority,
            dueDate,
            tags,
          });
        });
      }

      let output: string;

      if (options.format === 'json') {
        output = JSON.stringify(tasks, null, 2);
      } else if (options.format === 'csv') {
        output = 'file,line,status,priority,due,text\n' +
          tasks.map(t =>
            `"${t.file}",${t.line},${t.completed ? 'done' : 'todo'},${t.priority || ''},${t.dueDate || ''},"${t.text.replace(/"/g, '""')}"`
          ).join('\n');
      } else if (options.format === 'todoist') {
        output = tasks.map(t => {
          let line = t.text;
          if (t.priority === 'high') line += ' !!1';
          else if (t.priority === 'low') line += ' !!4';
          if (t.dueDate) line += ` due ${t.dueDate}`;
          return line;
        }).join('\n');
      } else {
        // Markdown
        output = '# Extracted Tasks\n\n' +
          `Extracted: ${new Date().toISOString()}\n\n` +
          tasks.map(t => {
            const status = t.completed ? '[x]' : '[ ]';
            return `- ${status} ${t.text} *(${t.file}:${t.line})*`;
          }).join('\n');
      }

      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`Exported ${tasks.length} tasks to ${options.output}`));
      } else {
        console.log(output);
      }
    });

  // Extract headings
  program
    .command('extract:headings')
    .description('Extract headings from notes')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--level <n>', 'Filter by heading level (1-6)')
    .option('--format <format>', 'Output: text, json, toc', 'text')
    .option('-o, --output <file>', 'Save to file')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const headings: HeadingItem[] = [];
      const levelFilter = options.level ? parseInt(options.level, 10) : null;

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        const lines = note.content.split('\n');
        lines.forEach((line, idx) => {
          const match = line.match(/^(#{1,6})\s+(.+)/);
          if (!match) return;

          const level = match[1].length;
          if (levelFilter && level !== levelFilter) return;

          headings.push({
            text: match[2].trim(),
            level,
            line: idx + 1,
            file: notePath,
          });
        });
      }

      let output: string;

      if (options.format === 'json') {
        output = JSON.stringify(headings, null, 2);
      } else if (options.format === 'toc') {
        // Generate table of contents style
        const grouped = groupBy(headings, h => h.file);
        output = Object.entries(grouped).map(([file, fileHeadings]) => {
          const toc = fileHeadings.map(h =>
            '  '.repeat(h.level - 1) + '- ' + h.text
          ).join('\n');
          return `## ${file}\n\n${toc}`;
        }).join('\n\n');
      } else {
        output = headings.map(h =>
          '#'.repeat(h.level) + ' ' + h.text + chalk.gray(` (${h.file}:${h.line})`)
        ).join('\n');
      }

      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`Exported ${headings.length} headings to ${options.output}`));
      } else {
        console.log(output);
      }
    });

  // Extract content by pattern
  program
    .command('extract:pattern')
    .description('Extract content matching a pattern')
    .requiredOption('--pattern <regex>', 'Regex pattern to match')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--group <n>', 'Capture group to extract', '0')
    .option('--unique', 'Remove duplicates')
    .option('--format <format>', 'Output: text, json', 'text')
    .option('-o, --output <file>', 'Save to file')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const matches: Array<{ match: string; file: string; line: number }> = [];
      const regex = new RegExp(options.pattern, 'gm');
      const groupNum = parseInt(options.group, 10);

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        const lines = note.content.split('\n');
        lines.forEach((line, idx) => {
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(line)) !== null) {
            const extracted = groupNum > 0 && match[groupNum] ? match[groupNum] : match[0];
            matches.push({
              match: extracted,
              file: notePath,
              line: idx + 1,
            });
          }
        });
      }

      let results = matches;
      if (options.unique) {
        const seen = new Set<string>();
        results = matches.filter(m => {
          if (seen.has(m.match)) return false;
          seen.add(m.match);
          return true;
        });
      }

      let output: string;

      if (options.format === 'json') {
        output = JSON.stringify(results, null, 2);
      } else {
        output = results.map(m => m.match + chalk.gray(` (${m.file}:${m.line})`)).join('\n');
      }

      if (options.output) {
        await fs.writeFile(options.output, output.replace(/\x1b\[[0-9;]*m/g, ''), 'utf-8');
        console.log(chalk.green(`Extracted ${results.length} matches to ${options.output}`));
      } else {
        console.log(output);
      }
    });

  // Extract links
  program
    .command('extract:links')
    .description('Extract all links from vault')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('--type <type>', 'Link type: internal, external, all', 'all')
    .option('--format <format>', 'Output: text, json, csv', 'text')
    .option('-o, --output <file>', 'Save to file')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      interface ExtractedLink {
        source: string;
        target: string;
        type: string;
        line: number;
      }

      const links: ExtractedLink[] = [];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note) continue;

        // Internal links
        if (options.type !== 'external') {
          for (const link of note.links) {
            links.push({
              source: notePath,
              target: link.target,
              type: link.type,
              line: link.line,
            });
          }
        }

        // External links
        if (options.type !== 'internal') {
          const extRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
          const lines = note.content.split('\n');
          lines.forEach((line, idx) => {
            let match;
            while ((match = extRegex.exec(line)) !== null) {
              links.push({
                source: notePath,
                target: match[2],
                type: 'external',
                line: idx + 1,
              });
            }
          });
        }
      }

      let output: string;

      if (options.format === 'json') {
        output = JSON.stringify(links, null, 2);
      } else if (options.format === 'csv') {
        output = 'source,target,type,line\n' +
          links.map(l => `"${l.source}","${l.target}","${l.type}",${l.line}`).join('\n');
      } else {
        output = links.map(l =>
          `${l.source}:${l.line} -> ${l.target} (${l.type})`
        ).join('\n');
      }

      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`Extracted ${links.length} links to ${options.output}`));
      } else {
        console.log(output);
      }
    });

  // Extract frontmatter
  program
    .command('extract:frontmatter')
    .description('Extract frontmatter from all notes')
    .option('-p, --path <folder>', 'Limit to folder')
    .option('-k, --key <key>', 'Extract specific key only')
    .option('--format <format>', 'Output: json, csv, yaml', 'json')
    .option('-o, --output <file>', 'Save to file')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({ folder: options.path });

      const data: Array<{ file: string; frontmatter: Record<string, unknown> }> = [];

      for (const notePath of notes) {
        const note = await vault.readNote(notePath);
        if (!note || Object.keys(note.frontmatter).length === 0) continue;

        if (options.key) {
          if (options.key in note.frontmatter) {
            data.push({
              file: notePath,
              frontmatter: { [options.key]: note.frontmatter[options.key] },
            });
          }
        } else {
          data.push({
            file: notePath,
            frontmatter: note.frontmatter,
          });
        }
      }

      let output: string;

      if (options.format === 'json') {
        output = JSON.stringify(data, null, 2);
      } else if (options.format === 'csv') {
        // Get all unique keys
        const allKeys = new Set<string>();
        data.forEach(d => Object.keys(d.frontmatter).forEach(k => allKeys.add(k)));
        const keys = ['file', ...Array.from(allKeys)];

        output = keys.join(',') + '\n' +
          data.map(d => {
            return keys.map(k => {
              if (k === 'file') return `"${d.file}"`;
              const v = d.frontmatter[k];
              if (v === undefined) return '';
              if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
              return JSON.stringify(v);
            }).join(',');
          }).join('\n');
      } else {
        // YAML-ish
        output = data.map(d => {
          const yaml = Object.entries(d.frontmatter)
            .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
            .join('\n');
          return `${d.file}:\n${yaml}`;
        }).join('\n\n');
      }

      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`Extracted frontmatter from ${data.length} notes to ${options.output}`));
      } else {
        console.log(output);
      }
    });
}

// ============================================================================
// Eval Command (Advanced Queries)
// ============================================================================

export function evalCommands(program: Command): void {
  // Eval command for custom queries
  program
    .command('eval')
    .description('Execute custom JavaScript code against the vault')
    .requiredOption('--code <code>', 'JavaScript code to execute')
    .option('--format <format>', 'Output: text, json', 'text')
    .action(async (options) => {
      const vault = getVault();

      // Create a safe context with vault utilities
      const context = {
        vault,
        notes: await vault.listNotes(),
        tags: await vault.listTags(),
        folders: await vault.listFolders(),
        readNote: (p: string) => vault.readNote(p),
        search: (q: string) => vault.search({ query: q }),
        findByTag: (t: string) => vault.findByTag(t),
        backlinks: (p: string) => vault.getBacklinks(p),
        // Utilities
        path,
        basename: path.basename,
        dirname: path.dirname,
        // Results accumulator
        results: [] as unknown[],
        print: (msg: unknown) => console.log(msg),
      };

      try {
        // Execute the code
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFunction(
          ...Object.keys(context),
          `"use strict";\n${options.code}`
        );

        const result = await fn(...Object.values(context));

        if (result !== undefined) {
          if (options.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(result);
          }
        }
      } catch (error: any) {
        console.error(chalk.red('Eval error: ' + error.message));
        process.exit(1);
      }
    });
}

// ============================================================================
// Helper Functions
// ============================================================================

function outputResults(results: SearchResult[], format: string, contextLines: number): void {
  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (format === 'csv') {
    console.log('file,line,match,context');
    results.forEach(r => {
      r.matches.forEach(m => {
        const escaped = m.context.replace(/"/g, '""');
        console.log(`"${r.relativePath}",${m.line},"${m.text}","${escaped}"`);
      });
    });
    return;
  }

  if (format === 'paths') {
    results.forEach(r => console.log(r.relativePath));
    return;
  }

  // Text format
  console.log(chalk.bold(`\nSearch Results (${results.length} files):\n`));
  results.forEach(r => {
    console.log(chalk.cyan(r.relativePath) + chalk.gray(` (${r.matches.length} matches)`));
    r.matches.slice(0, 5).forEach(m => {
      console.log(`  ${chalk.yellow('L' + m.line)}: ${m.context}`);
    });
    if (r.matches.length > 5) {
      console.log(chalk.gray(`  ... and ${r.matches.length - 5} more`));
    }
    console.log();
  });
}

function outputList(title: string, items: string[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  if (format === 'paths') {
    items.forEach(item => console.log(item));
    return;
  }

  console.log(chalk.bold(`\n${title} (${items.length}):\n`));
  items.forEach(item => console.log('  ' + chalk.cyan(item)));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob: string): RegExp {
  const regex = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp('^' + regex + '$');
}

function countReplacements(original: string, replaced: string): number {
  // Simple heuristic: count differences
  let count = 0;
  let i = 0, j = 0;
  while (i < original.length && j < replaced.length) {
    if (original[i] !== replaced[j]) {
      count++;
      while (i < original.length && j < replaced.length && original[i] !== replaced[j]) {
        j++;
      }
    }
    i++;
    j++;
  }
  return Math.max(count, 1);
}

async function updateLinksToFile(vault: Vault, oldName: string, newName: string): Promise<void> {
  const notes = await vault.listNotes();

  for (const notePath of notes) {
    const note = await vault.readNote(notePath);
    if (!note) continue;

    // Check if note has links to old name
    const hasLink = note.links.some(l => l.target === oldName || l.target === oldName + '.md');
    if (!hasLink) continue;

    // Replace links
    let newContent = note.content;
    newContent = newContent.replace(
      new RegExp(`\\[\\[${escapeRegex(oldName)}(\\|[^\\]]*)?\\]\\]`, 'g'),
      `[[${newName}$1]]`
    );

    if (newContent !== note.content) {
      await vault.updateNote(notePath, newContent);
    }
  }
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function generateMarkdownReport(report: VaultReport): string {
  return `# Vault Report

Generated: ${report.timestamp}

## Overview

| Metric | Value |
|--------|-------|
| Notes | ${report.noteCount} |
| Folders | ${report.folderCount} |
| Tags | ${report.tagCount} |
| Total Size | ${formatBytes(report.totalSize)} |
| Avg Note Size | ${formatBytes(report.avgNoteSize)} |

## Tasks

| Status | Count |
|--------|-------|
| Total | ${report.taskStats.total} |
| Completed | ${report.taskStats.completed} |
| Pending | ${report.taskStats.pending} |
| Completion Rate | ${((report.taskStats.completed / report.taskStats.total) * 100 || 0).toFixed(1)}% |

## Links

| Metric | Count |
|--------|-------|
| Total Links | ${report.linkStats.total} |
| Internal Links | ${report.linkStats.internal} |
| Broken Links | ${report.linkStats.broken} |

## Top Tags

${report.topTags.map(t => `- #${t.tag} (${t.count})`).join('\n')}

## Recently Modified

${report.recentlyModified.map(f => `- ${f}`).join('\n')}

## Largest Notes

${report.largestNotes.map(n => `- ${n.file} (${formatBytes(n.size)})`).join('\n')}
`;
}

function printTextReport(report: VaultReport): void {
  console.log(chalk.bold('\n═══════════════════════════════════════════'));
  console.log(chalk.bold('              VAULT REPORT'));
  console.log(chalk.bold('═══════════════════════════════════════════\n'));

  console.log(chalk.cyan('Overview'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log('  Notes:         ' + report.noteCount);
  console.log('  Folders:       ' + report.folderCount);
  console.log('  Tags:          ' + report.tagCount);
  console.log('  Total Size:    ' + formatBytes(report.totalSize));
  console.log('  Avg Note Size: ' + formatBytes(report.avgNoteSize));

  console.log('\n' + chalk.cyan('Tasks'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log('  Total:      ' + report.taskStats.total);
  console.log('  Completed:  ' + chalk.green(report.taskStats.completed));
  console.log('  Pending:    ' + chalk.yellow(report.taskStats.pending));
  const completion = (report.taskStats.completed / report.taskStats.total) * 100 || 0;
  console.log('  Completion: ' + completion.toFixed(1) + '%');

  console.log('\n' + chalk.cyan('Links'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log('  Total:   ' + report.linkStats.total);
  console.log('  Internal:' + report.linkStats.internal);
  console.log('  Broken:  ' + chalk.red(report.linkStats.broken));

  console.log('\n' + chalk.cyan('Top Tags'));
  console.log(chalk.gray('─'.repeat(40)));
  report.topTags.forEach(t => {
    console.log(`  #${t.tag.padEnd(20)} ${t.count}`);
  });

  console.log('\n' + chalk.cyan('Recently Modified'));
  console.log(chalk.gray('─'.repeat(40)));
  report.recentlyModified.slice(0, 5).forEach(f => console.log('  ' + f));

  console.log('\n' + chalk.cyan('Largest Notes'));
  console.log(chalk.gray('─'.repeat(40)));
  report.largestNotes.slice(0, 5).forEach(n => {
    console.log(`  ${n.file.padEnd(35)} ${formatBytes(n.size)}`);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================================
// Export Registration Function
// ============================================================================

export function advancedVaultCommands(program: Command): void {
  advancedSearchCommands(program);
  bulkOperationsCommands(program);
  reportingCommands(program);
  graphAnalysisCommands(program);
  contentExtractionCommands(program);
  evalCommands(program);
}
