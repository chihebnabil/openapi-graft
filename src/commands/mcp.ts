/**
 * MCP command - generates MCP server scaffolding
 */

import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import type { CLIOptions } from '../types';
import { loadConfig } from '../config/loader';
import { parseSpec } from '../parser/openapi';
import { generateMCPServer } from '../mcp/generator';

/**
 * Run the MCP generate command
 */
export async function mcpCommand(options: CLIOptions): Promise<void> {
  const config = await loadConfig(options.config);

  if (!config.mcp || !config.mcp.enabled) {
    console.log(chalk.yellow('MCP server generation is disabled in graft.yml.'));
    console.log(chalk.gray('Add the following to your graft.yml to enable MCP:'));
    console.log(chalk.gray(''));
    console.log(chalk.gray('mcp:'));
    console.log(chalk.gray('  enabled: true'));
    console.log(chalk.gray('  output: ./mcp-server'));
    return;
  }

  // Parse the OpenAPI spec
  const parseSpinner = ora('Parsing OpenAPI spec').start();
  let spec: Awaited<ReturnType<typeof parseSpec>>;
  try {
    spec = await parseSpec(config.spec);
    parseSpinner.succeed(`Parsed ${spec.info.title} v${spec.info.version}`);
  } catch (error) {
    parseSpinner.fail(`Failed to parse spec: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Generate MCP server
  const genSpinner = ora('Generating MCP server scaffolding').start();
  
  try {
    await generateMCPServer(spec, config.mcp);
    genSpinner.succeed('MCP server scaffolding generated');
    
    console.log(chalk.green(`\nMCP server generated at: ${config.mcp.output}`));
    console.log(chalk.gray('\nTo get started:'));
    console.log(chalk.gray(`  cd ${config.mcp.output}`));
    console.log(chalk.gray('  npm install'));
    console.log(chalk.gray('  npm run build'));
    console.log(chalk.gray('  npm start'));
    console.log(chalk.gray('\nAdd to Claude Desktop config:'));
    console.log(chalk.gray(`  "mcpServers": {`));
    console.log(chalk.gray(`    "${spec.info.title.toLowerCase().replace(/\s+/g, '-')}": {`));
    console.log(chalk.gray(`      "command": "node",`));
    console.log(chalk.gray(`      "args": ["${config.mcp.output}/dist/index.js"]`));
    console.log(chalk.gray(`    }`));
    console.log(chalk.gray(`  }`));
  } catch (error) {
    genSpinner.fail(`Failed to generate MCP server: ${error instanceof Error ? error.message : String(error)}`);
    if (options.ci) {
      process.exit(1);
    }
  }
}
