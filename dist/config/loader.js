"use strict";
/**
 * Graft configuration loader
 * Loads and validates graft.yml configuration files
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.createDefaultConfig = createDefaultConfig;
exports.validateConfig = validateConfig;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const zod_1 = require("zod");
const supportedLanguages = ['typescript', 'python', 'go', 'java', 'rust'];
const sdkConfigSchema = zod_1.z.object({
    language: zod_1.z.enum(supportedLanguages).transform(s => s),
    output: zod_1.z.string(),
    package: zod_1.z.string().optional(),
    preserve: zod_1.z.array(zod_1.z.string()).optional(),
    templates: zod_1.z.string().optional(),
    options: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const mcpConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    output: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    version: zod_1.z.string().optional(),
});
const graftConfigSchema = zod_1.z.object({
    spec: zod_1.z.string(),
    sdks: zod_1.z.array(sdkConfigSchema),
    mcp: mcpConfigSchema.optional(),
    baseDir: zod_1.z.string().optional(),
});
/**
 * Load and validate graft.yml configuration
 */
async function loadConfig(configPath) {
    const cwd = process.cwd();
    // Search for graft.yml in order of precedence
    const searchPaths = configPath
        ? [path.resolve(configPath)]
        : [
            path.join(cwd, 'graft.yml'),
            path.join(cwd, 'graft.yaml'),
            path.join(cwd, '.graft.yml'),
            path.join(cwd, '.graft.yaml'),
            path.join(cwd, '.graft', 'config.yml'),
        ];
    for (const searchPath of searchPaths) {
        if (await fs.pathExists(searchPath)) {
            const content = await fs.readFile(searchPath, 'utf-8');
            const parsed = yaml.load(content);
            if (!parsed || typeof parsed !== 'object') {
                throw new Error(`Invalid YAML in config file: ${searchPath}`);
            }
            const result = graftConfigSchema.safeParse(parsed);
            if (!result.success) {
                const errors = result.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
                throw new Error(`Invalid graft configuration:\n${errors}`);
            }
            const config = {
                spec: path.resolve(path.dirname(searchPath), result.data.spec),
                sdks: result.data.sdks.map((sdk) => ({
                    language: sdk.language,
                    output: path.resolve(path.dirname(searchPath), sdk.output),
                    package: sdk.package,
                    preserve: sdk.preserve?.map(p => path.resolve(path.dirname(searchPath), p)),
                    templates: sdk.templates ? path.resolve(path.dirname(searchPath), sdk.templates) : undefined,
                    options: sdk.options,
                })),
                mcp: result.data.mcp ? {
                    enabled: result.data.mcp.enabled,
                    output: path.resolve(path.dirname(searchPath), result.data.mcp.output),
                    name: result.data.mcp.name,
                    version: result.data.mcp.version,
                } : undefined,
                baseDir: result.data.baseDir ? path.resolve(path.dirname(searchPath), result.data.baseDir) : path.join(cwd, '.graft', 'base'),
            };
            return config;
        }
    }
    throw new Error(`No graft.yml configuration found. Searched:\n${searchPaths.map(p => `  - ${p}`).join('\n')}\n\n` +
        `Run 'graft init' to create a new configuration, or specify --config <path>.`);
}
/**
 * Create a default graft.yml configuration file
 */
async function createDefaultConfig(outputPath, options) {
    const language = options?.language || 'typescript';
    const spec = options?.spec || './openapi.json';
    const config = {
        spec,
        sdks: [
            {
                language,
                output: `./sdks/${language}`,
                package: language === 'typescript' ? '@yourcompany/sdk' : 'yourcompany-sdk',
                preserve: [`./sdks/${language}/**/custom/**/*`],
            },
        ],
        mcp: {
            enabled: true,
            output: './mcp-server',
        },
    };
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, yaml.dump(config, { indent: 2 }), 'utf-8');
}
/**
 * Validate that a configuration has all required fields
 */
function validateConfig(config) {
    if (!config.spec) {
        throw new Error('Configuration missing required field: spec');
    }
    if (!config.sdks || config.sdks.length === 0) {
        throw new Error('Configuration must have at least one SDK target');
    }
    for (const sdk of config.sdks) {
        if (!sdk.output) {
            throw new Error(`SDK for ${sdk.language} missing required field: output`);
        }
        if (sdk.language === 'typescript' && !sdk.package) {
            console.warn(`Warning: TypeScript SDK without package name will use default`);
        }
    }
}
//# sourceMappingURL=loader.js.map