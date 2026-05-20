"use strict";
/**
 * Generate command - generates SDKs from OpenAPI spec
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
exports.generateCommand = generateCommand;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const loader_1 = require("../config/loader");
const openapi_1 = require("../parser/openapi");
const index_1 = require("../generators/index");
const merge_1 = require("../ast/merge");
const compiler_1 = require("../validator/compiler");
/**
 * Run the generate command
 */
async function generateCommand(options) {
    const config = await (0, loader_1.loadConfig)(options.config);
    // Validate spec exists
    if (!await fs.pathExists(config.spec)) {
        console.error(chalk_1.default.red(`OpenAPI spec not found: ${config.spec}`));
        process.exit(1);
    }
    console.log(chalk_1.default.blue(`Generating SDKs from ${config.spec}...\n`));
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
    // Generate each SDK
    for (const sdkConfig of config.sdks) {
        const genSpinner = (0, ora_1.default)(`Generating ${sdkConfig.language} SDK`).start();
        try {
            // Step 1: Generate new code ("theirs")
            const theirsDir = path.join(config.baseDir || '.graft/base', 'theirs', sdkConfig.language);
            await fs.ensureDir(theirsDir);
            // Generate fresh SDK to theirs directory
            await (0, index_1.generateSDK)(spec, {
                ...sdkConfig,
                output: theirsDir,
            });
            genSpinner.text = `Merging ${sdkConfig.language} SDK with custom annotations...`;
            // Step 2: Check if we have existing code to merge
            const oursDir = sdkConfig.output;
            const baseDir = path.join(config.baseDir || '.graft/base', sdkConfig.language);
            if (await fs.pathExists(oursDir)) {
                // There is existing code - perform 3-way merge
                const mergeResults = await (0, merge_1.performThreeWayMerge)(baseDir, oursDir, theirsDir, sdkConfig.language, sdkConfig.output);
                const totalConflicts = mergeResults.reduce((sum, r) => sum + r.conflicts.length, 0);
                const totalAnnotations = mergeResults.reduce((sum, r) => sum + r.annotationsApplied, 0);
                if (totalConflicts > 0) {
                    genSpinner.warn(`${sdkConfig.language} SDK generated with ${totalConflicts} merge conflicts`);
                    for (const result of mergeResults) {
                        for (const conflict of result.conflicts) {
                            console.log(chalk_1.default.yellow(`  ⚠ Conflict: ${conflict.block.annotation.id} (${conflict.block.annotation.type})`));
                            if (conflict.resolution) {
                                console.log(chalk_1.default.gray(`    ${conflict.resolution}`));
                            }
                        }
                    }
                    if (options.ci) {
                        console.error(chalk_1.default.red('\nFailing CI due to unresolved merge conflicts'));
                        process.exit(1);
                    }
                }
                else {
                    genSpinner.succeed(`${sdkConfig.language} SDK generated (${totalAnnotations} annotations preserved)`);
                }
                // Step 3: Validate merged output
                if (!options.dryRun) {
                    const validationResults = await (0, compiler_1.validateAllMerges)(mergeResults, sdkConfig.language, sdkConfig.output);
                    for (const v of validationResults) {
                        if (!v.success) {
                            console.log(chalk_1.default.yellow(`\n  ⚠ Validation issues in ${sdkConfig.language} SDK:`));
                            for (const error of v.errors) {
                                console.log(chalk_1.default.red(`    ${error.file}:${error.line || '?'} - ${error.message}`));
                            }
                            if (options.ci) {
                                console.error(chalk_1.default.red('\nFailing CI due to validation errors'));
                                process.exit(1);
                            }
                        }
                    }
                }
            }
            else {
                // No existing code - copy theirs to output
                await fs.copy(theirsDir, sdkConfig.output);
                genSpinner.succeed(`${sdkConfig.language} SDK generated (fresh)`);
            }
            // Update base to current generation
            await fs.ensureDir(baseDir);
            await fs.copy(theirsDir, baseDir);
            // Auto-annotate preserved files on first run
            if (sdkConfig.preserve && !await fs.pathExists(oursDir)) {
                for (const pattern of sdkConfig.preserve) {
                    // These patterns indicate files that should be auto-annotated
                    console.log(chalk_1.default.gray(`  Note: Files matching ${pattern} will be auto-preserved on first modification`));
                }
            }
        }
        catch (error) {
            genSpinner.fail(`Failed to generate ${sdkConfig.language} SDK: ${error instanceof Error ? error.message : String(error)}`);
            if (options.ci) {
                process.exit(1);
            }
        }
    }
    console.log(chalk_1.default.green('\nAll SDKs generated successfully!'));
}
//# sourceMappingURL=generate.js.map