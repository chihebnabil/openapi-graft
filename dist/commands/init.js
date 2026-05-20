"use strict";
/**
 * Init command - creates a new graft.yml configuration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const loader_1 = require("../config/loader");
/**
 * Run the init command
 */
async function initCommand(options = {}) {
    const cwd = process.cwd();
    const configPath = path.join(cwd, 'graft.yml');
    // Check if graft.yml already exists
    if (await fs.pathExists(configPath)) {
        console.log(chalk_1.default.yellow('graft.yml already exists in this directory.'));
        // Could prompt for overwrite here
        return;
    }
    const language = options.language || 'typescript';
    const spec = options.spec || './openapi.json';
    console.log(chalk_1.default.blue('Creating graft.yml...\n'));
    await (0, loader_1.createDefaultConfig)(configPath, { language, spec });
    console.log(chalk_1.default.green('Created graft.yml'));
    console.log(chalk_1.default.gray('\nConfiguration:'));
    console.log(chalk_1.default.gray(`  Spec: ${spec}`));
    console.log(chalk_1.default.gray(`  Language: ${language}`));
    console.log(chalk_1.default.gray(`  Output: ./sdks/${language}`));
    console.log(chalk_1.default.gray(`  MCP Server: ./mcp-server`));
    console.log(chalk_1.default.gray('\nEdit graft.yml to configure additional languages and options.'));
    console.log(chalk_1.default.blue('\nNext: Run `graft generate` to generate SDKs.'));
}
//# sourceMappingURL=init.js.map