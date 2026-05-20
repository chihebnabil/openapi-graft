"use strict";
/**
 * MCP command - generates MCP server scaffolding
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpCommand = mcpCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const loader_1 = require("../config/loader");
const openapi_1 = require("../parser/openapi");
const generator_1 = require("../mcp/generator");
/**
 * Run the MCP generate command
 */
async function mcpCommand(options) {
    const config = await (0, loader_1.loadConfig)(options.config);
    if (!config.mcp || !config.mcp.enabled) {
        console.log(chalk_1.default.yellow('MCP server generation is disabled in graft.yml.'));
        console.log(chalk_1.default.gray('Add the following to your graft.yml to enable MCP:'));
        console.log(chalk_1.default.gray(''));
        console.log(chalk_1.default.gray('mcp:'));
        console.log(chalk_1.default.gray('  enabled: true'));
        console.log(chalk_1.default.gray('  output: ./mcp-server'));
        return;
    }
    // Parse the OpenAPI spec
    const parseSpinner = (0, ora_1.default)('Parsing OpenAPI spec').start();
    let spec;
    try {
        spec = await (0, openapi_1.parseSpec)(config.spec);
        parseSpinner.succeed(`Parsed ${spec.info.title} v${spec.info.version}`);
    }
    catch (error) {
        parseSpinner.fail(`Failed to parse spec: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
    // Generate MCP server
    const genSpinner = (0, ora_1.default)('Generating MCP server scaffolding').start();
    try {
        await (0, generator_1.generateMCPServer)(spec, config.mcp);
        genSpinner.succeed('MCP server scaffolding generated');
        console.log(chalk_1.default.green(`\nMCP server generated at: ${config.mcp.output}`));
        console.log(chalk_1.default.gray('\nTo get started:'));
        console.log(chalk_1.default.gray(`  cd ${config.mcp.output}`));
        console.log(chalk_1.default.gray('  npm install'));
        console.log(chalk_1.default.gray('  npm run build'));
        console.log(chalk_1.default.gray('  npm start'));
        console.log(chalk_1.default.gray('\nAdd to Claude Desktop config:'));
        console.log(chalk_1.default.gray(`  "mcpServers": {`));
        console.log(chalk_1.default.gray(`    "${spec.info.title.toLowerCase().replace(/\s+/g, '-')}": {`));
        console.log(chalk_1.default.gray(`      "command": "node",`));
        console.log(chalk_1.default.gray(`      "args": ["${config.mcp.output}/dist/index.js"]`));
        console.log(chalk_1.default.gray(`    }`));
        console.log(chalk_1.default.gray(`  }`));
    }
    catch (error) {
        genSpinner.fail(`Failed to generate MCP server: ${error instanceof Error ? error.message : String(error)}`);
        if (options.ci) {
            process.exit(1);
        }
    }
}
//# sourceMappingURL=mcp.js.map