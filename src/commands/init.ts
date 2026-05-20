/**
 * Init command - creates a new graft.yml configuration
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import type { SupportedLanguage } from '../types';
import { createDefaultConfig } from '../config/loader';

interface InitOptions {
  language?: SupportedLanguage;
  spec?: string;
  yes?: boolean;
}

/**
 * Run the init command
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'graft.yml');

  // Check if graft.yml already exists
  if (await fs.pathExists(configPath)) {
    console.log(chalk.yellow('graft.yml already exists in this directory.'));
    // Could prompt for overwrite here
    return;
  }

  const language = options.language || 'typescript';
  const spec = options.spec || './openapi.json';

  console.log(chalk.blue('Creating graft.yml...\n'));

  await createDefaultConfig(configPath, { language, spec });

  console.log(chalk.green('Created graft.yml'));
  console.log(chalk.gray('\nConfiguration:'));
  console.log(chalk.gray(`  Spec: ${spec}`));
  console.log(chalk.gray(`  Language: ${language}`));
  console.log(chalk.gray(`  Output: ./sdks/${language}`));
  console.log(chalk.gray(`  MCP Server: ./mcp-server`));
  console.log(chalk.gray('\nEdit graft.yml to configure additional languages and options.'));
  console.log(chalk.blue('\nNext: Run `graft generate` to generate SDKs.'));
}
