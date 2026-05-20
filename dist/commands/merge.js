"use strict";
/**
 * Merge command - manually trigger a 3-way merge
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
exports.mergeCommand = mergeCommand;
const fs = __importStar(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const merge_1 = require("../ast/merge");
const compiler_1 = require("../validator/compiler");
/**
 * Run the merge command
 */
async function mergeCommand(options) {
    const { base, ours, theirs, language, output } = options;
    // Validate paths
    if (!ours || !theirs) {
        console.error(chalk_1.default.red('Missing required paths:'));
        if (!ours)
            console.error(chalk_1.default.red('  --ours <path>  (current working copy with custom code)'));
        if (!theirs)
            console.error(chalk_1.default.red('  --theirs <path>  (new generated code)'));
        process.exit(1);
    }
    if (!await fs.pathExists(ours)) {
        console.error(chalk_1.default.red(`Ours path does not exist: ${ours}`));
        process.exit(1);
    }
    if (!await fs.pathExists(theirs)) {
        console.error(chalk_1.default.red(`Theirs path does not exist: ${theirs}`));
        process.exit(1);
    }
    // Base defaults to theirs if not provided (first generation)
    const baseDir = base || theirs;
    console.log(chalk_1.default.blue(`Performing 3-way merge for ${language}...\n`));
    console.log(chalk_1.default.gray(`  Base: ${baseDir}`));
    console.log(chalk_1.default.gray(`  Ours: ${ours}`));
    console.log(chalk_1.default.gray(`  Theirs: ${theirs}`));
    console.log(chalk_1.default.gray(`  Output: ${output}\n`));
    const mergeSpinner = (0, ora_1.default)('Merging files').start();
    try {
        const mergeResults = await (0, merge_1.performThreeWayMerge)(baseDir, ours, theirs, language, output);
        const totalFiles = mergeResults.length;
        const totalConflicts = mergeResults.reduce((sum, r) => sum + r.conflicts.length, 0);
        const totalAnnotations = mergeResults.reduce((sum, r) => sum + r.annotationsApplied, 0);
        if (totalConflicts > 0) {
            mergeSpinner.warn(`Merge completed with ${totalConflicts} conflicts`);
            for (const result of mergeResults) {
                for (const conflict of result.conflicts) {
                    console.log(chalk_1.default.yellow(`\n  ⚠ Conflict in annotation: ${conflict.block.annotation.id}`));
                    console.log(chalk_1.default.gray(`    Type: ${conflict.block.annotation.type}`));
                    if (conflict.resolution) {
                        console.log(chalk_1.default.gray(`    Reason: ${conflict.resolution}`));
                    }
                }
            }
            if (options.ci) {
                console.error(chalk_1.default.red('\nFailing CI due to unresolved merge conflicts'));
                process.exit(1);
            }
        }
        else {
            mergeSpinner.succeed(`Merged ${totalFiles} files (${totalAnnotations} annotations preserved)`);
        }
        // Validate merged output
        const validateSpinner = (0, ora_1.default)('Validating merged output').start();
        const validationResults = await (0, compiler_1.validateAllMerges)(mergeResults, language, output);
        const validationErrors = validationResults.filter(v => !v.success);
        if (validationErrors.length > 0) {
            validateSpinner.warn('Validation completed with issues');
            for (const v of validationErrors) {
                for (const error of v.errors) {
                    console.log(chalk_1.default.red(`  ${error.file}:${error.line || '?'} - ${error.message}`));
                }
            }
            if (options.ci) {
                console.error(chalk_1.default.red('\nFailing CI due to validation errors'));
                process.exit(1);
            }
        }
        else {
            validateSpinner.succeed('Validation passed');
        }
        console.log(chalk_1.default.green(`\nMerge output written to: ${output}`));
    }
    catch (error) {
        mergeSpinner.fail(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
        if (options.ci) {
            process.exit(1);
        }
    }
}
//# sourceMappingURL=merge.js.map