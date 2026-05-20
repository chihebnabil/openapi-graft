#!/usr/bin/env node
"use strict";
/**
 * Graft CLI
 * OpenAPI SDK generator with AST-level 3-way merge and MCP server scaffolding
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const generate_1 = require("./commands/generate");
const init_1 = require("./commands/init");
const mcp_1 = require("./commands/mcp");
const merge_1 = require("./commands/merge");
const program = new commander_1.Command();
program
    .name('graft')
    .description(chalk_1.default.bold('Graft - OpenAPI SDK generator with AST-level 3-way merge'))
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
    const options = {
        config: program.opts().config,
        verbose: program.opts().verbose,
        ci: program.opts().ci,
        dryRun: program.opts().dryRun,
    };
    try {
        await (0, generate_1.generateCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
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
        await (0, init_1.initCommand)({
            language: cmdOptions.language,
            spec: cmdOptions.spec,
            yes: cmdOptions.yes,
        });
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
});
// MCP command - generate MCP server
program
    .command('mcp')
    .description('Generate MCP server scaffolding from OpenAPI spec')
    .action(async () => {
    const options = {
        config: program.opts().config,
        verbose: program.opts().verbose,
        ci: program.opts().ci,
        dryRun: program.opts().dryRun,
    };
    try {
        await (0, mcp_1.mcpCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
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
        language: cmdOptions.language,
        output: cmdOptions.output,
    };
    try {
        await (0, merge_1.mergeCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
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
        console.log(chalk_1.default.blue('Graft Status'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`Config: ${chalk_1.default.cyan(config.spec)}`);
        try {
            const spec = await parseSpec(config.spec);
            console.log(`Spec: ${chalk_1.default.cyan(spec.info.title)} v${chalk_1.default.cyan(spec.info.version)}`);
            console.log(`Paths: ${chalk_1.default.cyan(Object.keys(spec.paths).length.toString())}`);
            console.log(`Schemas: ${chalk_1.default.cyan((spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0).toString())}`);
        }
        catch {
            console.log(chalk_1.default.yellow('⚠ Could not parse spec'));
        }
        console.log('\nSDKs:');
        for (const sdk of config.sdks) {
            const fs = await import('fs-extra');
            const exists = await fs.pathExists(sdk.output);
            console.log(`  ${sdk.language}: ${chalk_1.default.cyan(sdk.output)} ${exists ? chalk_1.default.green('✓') : chalk_1.default.gray('(not generated)')}`);
        }
        if (config.mcp?.enabled) {
            const fs = await import('fs-extra');
            const exists = await fs.pathExists(config.mcp.output);
            console.log(`\nMCP Server: ${chalk_1.default.cyan(config.mcp.output)} ${exists ? chalk_1.default.green('✓') : chalk_1.default.gray('(not generated)')}`);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
});
// Parse command line arguments
program.parse();
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.help();
}
//# sourceMappingURL=index.js.map