#!/usr/bin/env node

/**
 * Graft CLI
 * OpenAPI SDK generator with AST-level 3-way merge and MCP server scaffolding
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';
import { mcpCommand } from './commands/mcp';
import { mergeCommand } from './commands/merge';
import type { CLIOptions, SupportedLanguage } from './types';

const program = new Command();

program
  .name('openapi-graft')
  .description(chalk.bold('openapi-graft - OpenAPI SDK generator with AST-level 3-way merge'))
  .version('0.1.0');

// Global options
program
  .option('-c, --config <path>', 'path to graft.yml config file')
  .option('-v, --verbose', 'enable verbose output')
  .option('--ci', 'run in CI mode (strict exit codes)')
  .option('--dry-run', 'simulate without writing files');

// Generate command - main SDK generation
program
  .command('generate')
  .alias('gen')
  .description('Generate SDKs from OpenAPI spec')
  .action(async () => {
    const options: CLIOptions = {
      config: program.opts().config,
      verbose: program.opts().verbose,
      ci: program.opts().ci,
      dryRun: program.opts().dryRun,
    };

    try {
      await generateCommand(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Init command - create new graft.yml
program
  .command('init')
  .description('Initialize a new graft.yml configuration')
  .option('-l, --language <lang>', 'primary SDK language (typescript, python, go, java, rust)', 'typescript')
  .option('-s, --spec <path>', 'path to OpenAPI spec file', './openapi.json')
  .option('-y, --yes', 'accept all defaults')
  .action(async (cmdOptions) => {
    try {
      await initCommand({
        language: cmdOptions.language as SupportedLanguage,
        spec: cmdOptions.spec,
        yes: cmdOptions.yes,
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// MCP command - generate MCP server
program
  .command('mcp')
  .description('Generate MCP server scaffolding from OpenAPI spec')
  .action(async () => {
    const options: CLIOptions = {
      config: program.opts().config,
      verbose: program.opts().verbose,
      ci: program.opts().ci,
      dryRun: program.opts().dryRun,
    };

    try {
      await mcpCommand(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Merge command - manual 3-way merge
program
  .command('merge')
  .description('Perform a manual 3-way AST merge')
  .requiredOption('--base <path>', 'base directory (previous clean generation)')
  .requiredOption('--ours <path>', 'ours directory (current working copy with custom code)')
  .requiredOption('--theirs <path>', 'theirs directory (new generated code)')
  .requiredOption('-l, --language <lang>', 'language (typescript, python, go, java, rust)')
  .requiredOption('-o, --output <path>', 'output directory for merged code')
  .action(async (cmdOptions) => {
    const options = {
      config: program.opts().config,
      verbose: program.opts().verbose,
      ci: program.opts().ci,
      dryRun: program.opts().dryRun,
      base: cmdOptions.base,
      ours: cmdOptions.ours,
      theirs: cmdOptions.theirs,
      language: cmdOptions.language as SupportedLanguage,
      output: cmdOptions.output,
    };

    try {
      await mergeCommand(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Status command - show current status
program
  .command('status')
  .description('Show current graft status')
  .action(async () => {
    try {
      const { loadConfig } = await import('./config/loader.js');
      const { parseSpec } = await import('./parser/openapi.js');
      const config = await loadConfig(program.opts().config);
      
      console.log(chalk.blue('Graft Status'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`Config: ${chalk.cyan(config.spec)}`);
      
      try {
        const spec = await parseSpec(config.spec);
        console.log(`Spec: ${chalk.cyan(spec.info.title)} v${chalk.cyan(spec.info.version)}`);
        console.log(`Paths: ${chalk.cyan(Object.keys(spec.paths).length.toString())}`);
        console.log(`Schemas: ${chalk.cyan((spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0).toString())}`);
      } catch {
        console.log(chalk.yellow('⚠ Could not parse spec'));
      }

      console.log('\nSDKs:');
      for (const sdk of config.sdks) {
        const fs = await import('fs-extra');
        const exists = await fs.pathExists(sdk.output);
        console.log(`  ${sdk.language}: ${chalk.cyan(sdk.output)} ${exists ? chalk.green('✓') : chalk.gray('(not generated)')}`);
      }

      if (config.mcp?.enabled) {
        const fs = await import('fs-extra');
        const exists = await fs.pathExists(config.mcp.output);
        console.log(`\nMCP Server: ${chalk.cyan(config.mcp.output)} ${exists ? chalk.green('✓') : chalk.gray('(not generated)')}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.help();
}
