/**
 * Core Commands
 *
 * Essential commands: help, version, config, reload
 */

import { Command } from 'commander';

export function coreCommands(program: Command): void {
  // Help command (enhanced)
  program
    .command('help [command]')
    .description('Show help for a command')
    .action((command?: string) => {
      if (command) {
        const cmd = program.commands.find(c => c.name() === command);
        if (cmd) {
          cmd.outputHelp();
        } else {
          console.log(`Unknown command: ${command}`);
        }
      } else {
        program.outputHelp();
      }
    });

  // Version command (enhanced)
  program
    .command('version')
    .description('Show version information')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const info = {
        name: 'structure-cli',
        version: '0.1.0',
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log(`structure-cli v${info.version}`);
        console.log(`Node ${info.node} | ${info.platform} ${info.arch}`);
      }
    });

  // Config command
  program
    .command('config')
    .description('View or edit configuration')
    .option('--get <key>', 'Get a config value')
    .option('--set <key=value>', 'Set a config value')
    .option('--list', 'List all config values')
    .option('--scope <scope>', 'Config scope: user, project, local')
    .action(async (options) => {
      // TODO: Implement config management
      console.log('Config command:', options);
    });

  // Reload command
  program
    .command('reload')
    .description('Reload configuration and plugins')
    .action(async () => {
      console.log('Reloading configuration...');
      // TODO: Implement reload logic
    });

  // Init command (like /init in Claude Code)
  program
    .command('init')
    .description('Initialize STRUCTURE.md for current project')
    .option('--force', 'Overwrite existing STRUCTURE.md')
    .action(async (options) => {
      // TODO: Implement init wizard
      console.log('Initializing project...', options);
    });
}
