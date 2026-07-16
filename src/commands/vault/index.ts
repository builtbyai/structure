/**
 * Vault Commands
 *
 * Obsidian vault operations: notes, search, daily notes, tags, backlinks
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Vault, vaultManager, SearchResult } from '../../vault/index.js';
import { advancedVaultCommands } from './advanced.js';

let activeVault: Vault | null = null;

export function setActiveVault(vault: Vault): void {
  activeVault = vault;
}

export function getVault(): Vault {
  if (!activeVault) {
    throw new Error('No vault opened. Use --vault <path> to specify a vault.');
  }
  return activeVault;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function vaultCommands(program: Command): void {
  // Vault info command
  program
    .command('vault')
    .description('Show vault information')
    .action(async () => {
      const vault = getVault();
      const isObsidian = await vault.isObsidianVault();
      const stats = await vault.getStats();

      console.log(chalk.bold('\nVault Information'));
      console.log(chalk.gray('-'.repeat(40)));
      console.log('Name:       ', chalk.cyan(vault.name));
      console.log('Path:       ', vault.vaultPath);
      console.log('Obsidian:   ', isObsidian ? chalk.green('Yes') : chalk.yellow('No'));
      console.log('Notes:      ', stats.noteCount);
      console.log('Folders:    ', stats.folderCount);
      console.log('Tags:       ', stats.tagCount);
      console.log('Total size: ', formatBytes(stats.totalSize));
    });

  // Note read command
  program
    .command('note <path>')
    .description('Read a note')
    .option('--json', 'Output as JSON')
    .option('--meta', 'Show metadata only')
    .action(async (notePath, options) => {
      const vault = getVault();
      const note = await vault.readNote(notePath);

      if (!note) {
        console.error(chalk.red('Note not found: ' + notePath));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(note, null, 2));
      } else if (options.meta) {
        console.log(chalk.bold(note.name));
        console.log(chalk.gray('-'.repeat(40)));
        console.log('Path:     ', note.relativePath);
        console.log('Tags:     ', note.tags.join(', ') || '(none)');
        console.log('Links:    ', note.links.length);
        console.log('Created:  ', note.created?.toLocaleString());
        console.log('Modified: ', note.modified?.toLocaleString());
        if (Object.keys(note.frontmatter).length > 0) {
          console.log('\nFrontmatter:');
          for (const [key, value] of Object.entries(note.frontmatter)) {
            console.log('  ' + key + ': ' + value);
          }
        }
      } else {
        console.log(note.content);
      }
    });

  // Note create command
  program
    .command('note:new <path>')
    .description('Create a new note')
    .option('-c, --content <content>', 'Initial content')
    .option('-t, --template <name>', 'Use template')
    .option('--overwrite', 'Overwrite if exists')
    .action(async (notePath, options) => {
      const vault = getVault();

      try {
        const note = await vault.createNote(notePath, options.content || '', {
          overwrite: options.overwrite,
          template: options.template,
        });
        console.log(chalk.green('Created: ' + note.relativePath));
      } catch (error: any) {
        console.error(chalk.red('Error: ' + error.message));
        process.exit(1);
      }
    });

  // Note edit command
  program
    .command('note:edit <path>')
    .description('Edit note content')
    .option('-c, --content <content>', 'New content')
    .option('--append <text>', 'Append text')
    .option('--prepend <text>', 'Prepend text')
    .action(async (notePath, options) => {
      const vault = getVault();

      try {
        let note;
        if (options.append) {
          note = await vault.appendToNote(notePath, options.append);
          console.log(chalk.green('Appended to: ' + note.relativePath));
        } else if (options.prepend) {
          note = await vault.prependToNote(notePath, options.prepend);
          console.log(chalk.green('Prepended to: ' + note.relativePath));
        } else if (options.content) {
          note = await vault.updateNote(notePath, options.content);
          console.log(chalk.green('Updated: ' + note.relativePath));
        } else {
          console.error(chalk.red('Provide --content, --append, or --prepend'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error: ' + error.message));
        process.exit(1);
      }
    });

  // Note delete command
  program
    .command('note:delete <path>')
    .description('Delete a note')
    .option('--permanent', 'Delete permanently (skip trash)')
    .action(async (notePath, options) => {
      const vault = getVault();
      const deleted = await vault.deleteNote(notePath, {
        permanent: options.permanent,
      });

      if (deleted) {
        console.log(chalk.green('Deleted: ' + notePath));
      } else {
        console.error(chalk.red('Failed to delete: ' + notePath));
        process.exit(1);
      }
    });

  // Note move command
  program
    .command('note:move <source> <destination>')
    .description('Move or rename a note')
    .action(async (source, destination) => {
      const vault = getVault();

      try {
        const note = await vault.moveNote(source, destination);
        console.log(chalk.green('Moved: ' + source + ' -> ' + note.relativePath));
      } catch (error: any) {
        console.error(chalk.red('Error: ' + error.message));
        process.exit(1);
      }
    });

  // List notes command
  program
    .command('notes')
    .description('List all notes')
    .option('-f, --folder <folder>', 'List from folder')
    .option('--flat', 'Non-recursive listing')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const vault = getVault();
      const notes = await vault.listNotes({
        folder: options.folder,
        recursive: !options.flat,
      });

      if (options.json) {
        console.log(JSON.stringify(notes, null, 2));
      } else {
        console.log(chalk.bold('\nNotes (' + notes.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        notes.forEach(note => console.log('  ' + note));
      }
    });

  // List folders command
  program
    .command('folders')
    .description('List all folders')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const vault = getVault();
      const folders = await vault.listFolders();

      if (options.json) {
        console.log(JSON.stringify(folders, null, 2));
      } else {
        console.log(chalk.bold('\nFolders (' + folders.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        folders.forEach(folder => console.log('  ' + folder + '/'));
      }
    });

  // List tags command
  program
    .command('tags')
    .description('List all tags with counts')
    .option('--json', 'Output as JSON')
    .option('--sort <by>', 'Sort by: count, name', 'count')
    .action(async (options) => {
      const vault = getVault();
      const tagCounts = await vault.listTags();

      const entries = Array.from(tagCounts.entries());
      if (options.sort === 'name') {
        entries.sort((a, b) => a[0].localeCompare(b[0]));
      } else {
        entries.sort((a, b) => b[1] - a[1]);
      }

      if (options.json) {
        console.log(JSON.stringify(Object.fromEntries(entries), null, 2));
      } else {
        console.log(chalk.bold('\nTags (' + entries.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        entries.forEach(([tag, count]) => {
          console.log('  #' + tag + chalk.gray(' (' + count + ')'));
        });
      }
    });

  // Search command
  program
    .command('search:vault')
    .description('Search notes in vault')
    .requiredOption('-q, --query <query>', 'Search query')
    .option('-f, --folder <folder>', 'Limit to folder')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-l, --limit <n>', 'Max results', '20')
    .option('--regex', 'Use regex pattern')
    .option('--case', 'Case sensitive')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const vault = getVault();
      const results = await vault.search({
        query: options.query,
        folder: options.folder,
        tags: options.tag ? [options.tag] : undefined,
        limit: parseInt(options.limit, 10),
        regex: options.regex,
        caseSensitive: options.case,
      });

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.bold('\nSearch Results (' + results.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));

        results.forEach((result: SearchResult) => {
          console.log(chalk.cyan(result.relativePath) + chalk.gray(' (' + result.matches.length + ' matches)'));
          result.matches.slice(0, 3).forEach(match => {
            console.log('  ' + chalk.yellow('L' + match.line) + ': ' + match.context);
          });
          if (result.matches.length > 3) {
            console.log(chalk.gray('  ... and ' + (result.matches.length - 3) + ' more'));
          }
          console.log();
        });
      }
    });

  // Find by title command
  program
    .command('find:title <query>')
    .description('Find notes by title')
    .option('--fuzzy', 'Enable fuzzy matching')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      const vault = getVault();
      const results = await vault.findByTitle(query, options.fuzzy);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.bold('\nNotes matching "' + query + '" (' + results.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        results.forEach(note => console.log('  ' + note));
      }
    });

  // Find by tag command
  program
    .command('find:tag <tag>')
    .description('Find notes by tag')
    .option('--json', 'Output as JSON')
    .action(async (tag, options) => {
      const vault = getVault();
      const results = await vault.findByTag(tag);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.bold('\nNotes with tag #' + tag + ' (' + results.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        results.forEach(note => console.log('  ' + note));
      }
    });

  // Backlinks command
  program
    .command('backlinks <path>')
    .description('Find notes linking to a note')
    .option('--json', 'Output as JSON')
    .action(async (notePath, options) => {
      const vault = getVault();
      const backlinks = await vault.getBacklinks(notePath);

      if (options.json) {
        console.log(JSON.stringify(backlinks, null, 2));
      } else {
        console.log(chalk.bold('\nBacklinks to ' + notePath + ' (' + backlinks.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        backlinks.forEach(link => console.log('  ' + link));
      }
    });

  // Daily note command
  program
    .command('daily')
    .description('Open or create today\'s daily note')
    .option('-d, --date <date>', 'Specific date (YYYY-MM-DD)')
    .option('-t, --template <name>', 'Use template')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const vault = getVault();
      const date = options.date ? new Date(options.date) : new Date();

      const note = await vault.dailyNote({
        date,
        template: options.template,
      });

      if (options.json) {
        console.log(JSON.stringify(note, null, 2));
      } else {
        console.log(chalk.green('Daily note: ' + note.relativePath));
        console.log(chalk.gray('-'.repeat(40)));
        console.log(note.content);
      }
    });

  // List daily notes command
  program
    .command('daily:list')
    .description('List all daily notes')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const vault = getVault();
      const dailyNotes = await vault.listDailyNotes();

      if (options.json) {
        console.log(JSON.stringify(dailyNotes, null, 2));
      } else {
        console.log(chalk.bold('\nDaily Notes (' + dailyNotes.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        dailyNotes.forEach(note => console.log('  ' + note));
      }
    });

  // List templates command
  program
    .command('templates')
    .description('List available templates')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const vault = getVault();
      const templates = await vault.listTemplates();

      if (options.json) {
        console.log(JSON.stringify(templates, null, 2));
      } else {
        console.log(chalk.bold('\nTemplates (' + templates.length + ')'));
        console.log(chalk.gray('-'.repeat(40)));
        templates.forEach(t => console.log('  ' + t));
      }
    });

  // Frontmatter commands
  program
    .command('frontmatter <path>')
    .description('Show note frontmatter')
    .option('--json', 'Output as JSON')
    .action(async (notePath, options) => {
      const vault = getVault();
      const fm = await vault.getFrontmatter(notePath);

      if (!fm) {
        console.error(chalk.red('Note not found: ' + notePath));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(fm, null, 2));
      } else {
        console.log(chalk.bold('\nFrontmatter: ' + notePath));
        console.log(chalk.gray('-'.repeat(40)));
        if (Object.keys(fm).length === 0) {
          console.log('  (no frontmatter)');
        } else {
          for (const [key, value] of Object.entries(fm)) {
            console.log('  ' + key + ': ' + value);
          }
        }
      }
    });

  program
    .command('frontmatter:set <path> <key> <value>')
    .description('Set a frontmatter field')
    .action(async (notePath, key, value) => {
      const vault = getVault();

      try {
        const note = await vault.updateFrontmatter(notePath, key, value);
        console.log(chalk.green('Updated frontmatter: ' + key + ' = ' + value));
      } catch (error: any) {
        console.error(chalk.red('Error: ' + error.message));
        process.exit(1);
      }
    });

  // Register advanced vault commands
  advancedVaultCommands(program);
}
