"use strict";
/**
 * Post-merge validator
 * Validates merged output by attempting to compile/type-check it before writing
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
exports.validateMerge = validateMerge;
exports.validateAllMerges = validateAllMerges;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Validate a merge result by compiling the output
 */
async function validateMerge(mergeResult, language, outputDir) {
    const errors = [];
    const warnings = [];
    if (!mergeResult.success) {
        return {
            success: false,
            language,
            errors: mergeResult.conflicts.map(c => ({
                file: 'merge',
                message: `Conflict in block ${c.block.annotation.id}: ${c.resolution || 'Unresolved conflict'}`,
                severity: 'error',
            })),
            warnings,
        };
    }
    // Write to a temp directory for validation
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'graft-validate-'));
    try {
        // Write the merged content to temp file
        const tmpFile = path.join(tmpDir, `output.${getExtension(language)}`);
        await fs.ensureDir(path.dirname(tmpFile));
        await fs.writeFile(tmpFile, mergeResult.output, 'utf-8');
        // Validate based on language
        switch (language) {
            case 'typescript':
                await validateTypeScript(tmpDir, tmpFile, errors, warnings);
                break;
            case 'python':
                await validatePython(tmpDir, tmpFile, errors, warnings);
                break;
            case 'go':
                await validateGo(tmpDir, tmpFile, errors, warnings);
                break;
            case 'java':
                await validateJava(tmpDir, tmpFile, errors, warnings);
                break;
            case 'rust':
                await validateRust(tmpDir, tmpFile, errors, warnings);
                break;
        }
        return {
            success: errors.length === 0,
            language,
            errors,
            warnings,
        };
    }
    catch (error) {
        return {
            success: false,
            language,
            errors: [{
                    file: 'validation',
                    message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
                    severity: 'error',
                }],
            warnings,
        };
    }
    finally {
        // Cleanup
        await fs.remove(tmpDir);
    }
}
/**
 * Validate TypeScript code
 */
async function validateTypeScript(tmpDir, file, errors, warnings) {
    // Write a minimal tsconfig
    const tsConfig = {
        compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
        },
        include: ['./*.ts'],
    };
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2), 'utf-8');
    try {
        (0, child_process_1.execSync)('npx tsc --noEmit 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
    }
    catch (error) {
        // Parse TypeScript errors
        const output = error.stdout || error.message || '';
        const lines = output.split('\n');
        for (const line of lines) {
            const match = line.match(/(.+)\((\d+),(\d+)\):\s*(error|warning)\s+TS\d+:\s*(.+)/);
            if (match) {
                const [, filePath, lineNum, colNum, severity, message] = match;
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(colNum, 10),
                    message,
                    severity: severity,
                });
            }
        }
    }
}
/**
 * Validate Python code
 */
async function validatePython(tmpDir, file, errors, warnings) {
    try {
        // Try py_compile first
        (0, child_process_1.execSync)(`python3 -m py_compile ${path.basename(file)} 2>&1`, { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
    }
    catch (error) {
        const output = error.stdout || error.message || '';
        // Parse Python syntax errors
        const lines = output.split('\n');
        for (const line of lines) {
            const match = line.match(/\s*File\s+"(.+)",\s+line\s+(\d+).?\s*(.*)/);
            if (match) {
                const [, filePath, lineNum, message] = match;
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    message: message || 'Syntax error',
                    severity: 'error',
                });
            }
        }
    }
    // Try mypy if available
    try {
        (0, child_process_1.execSync)('which mypy', { encoding: 'utf-8', timeout: 5000 });
        try {
            (0, child_process_1.execSync)(`mypy --ignore-missing-imports ${path.basename(file)} 2>&1`, { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
        }
        catch (error) {
            const output = error.stdout || '';
            const lines = output.split('\n');
            for (const line of lines) {
                const match = line.match(/(.+):(\d+):\s*(error|warning):\s*(.+)/);
                if (match) {
                    const [, filePath, lineNum, severity, message] = match;
                    errors.push({
                        file: filePath,
                        line: parseInt(lineNum, 10),
                        message,
                        severity: severity,
                    });
                }
            }
        }
    }
    catch {
        warnings.push('mypy not installed, skipping type checking');
    }
}
/**
 * Validate Go code
 */
async function validateGo(tmpDir, file, errors, warnings) {
    // Create a go.mod
    const goMod = `module graft-temp\n\ngo 1.21\n`;
    await fs.writeFile(path.join(tmpDir, 'go.mod'), goMod, 'utf-8');
    try {
        (0, child_process_1.execSync)('go build . 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
    }
    catch (error) {
        const output = error.stdout || error.message || '';
        const lines = output.split('\n');
        for (const line of lines) {
            const match = line.match(/(.+):(\d+):(\d+):\s*(.+)/);
            if (match) {
                const [, filePath, lineNum, colNum, message] = match;
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(colNum, 10),
                    message,
                    severity: 'error',
                });
            }
        }
    }
    // Try go vet
    try {
        (0, child_process_1.execSync)('go vet . 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
    }
    catch (error) {
        const output = error.stdout || '';
        warnings.push(`go vet: ${output.trim()}`);
    }
}
/**
 * Validate Java code
 */
async function validateJava(tmpDir, file, errors, warnings) {
    // Check for javac
    try {
        (0, child_process_1.execSync)('which javac', { encoding: 'utf-8', timeout: 5000 });
    }
    catch {
        warnings.push('javac not found, skipping compilation check');
        return;
    }
    try {
        (0, child_process_1.execSync)(`javac -d . ${path.basename(file)} 2>&1`, { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
    }
    catch (error) {
        const output = error.stdout || error.message || '';
        const lines = output.split('\n');
        for (const line of lines) {
            const match = line.match(/(.+):(\d+):\s*(error|warning):\s*(.+)/);
            if (match) {
                const [, filePath, lineNum, severity, message] = match;
                errors.push({
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    message,
                    severity: severity,
                });
            }
        }
    }
}
/**
 * Validate Rust code
 */
async function validateRust(tmpDir, file, errors, warnings) {
    // Create a minimal Cargo.toml
    const cargoToml = `[package]
name = "graft-temp"
version = "0.1.0"
edition = "2021"
`;
    await fs.writeFile(path.join(tmpDir, 'Cargo.toml'), cargoToml, 'utf-8');
    await fs.ensureDir(path.join(tmpDir, 'src'));
    await fs.copyFile(file, path.join(tmpDir, 'src', 'lib.rs'));
    try {
        (0, child_process_1.execSync)('cargo check 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 60000 });
    }
    catch (error) {
        const output = error.stdout || error.message || '';
        const lines = output.split('\n');
        for (const line of lines) {
            // Rust error format: --> src/lib.rs:42:5
            const match = line.match(/-->\s+(.+):(\d+):(\d+)/);
            if (match) {
                const [, filePath, lineNum, colNum] = match;
                // The actual error message is usually the next line
                const errorLine = lines[lines.indexOf(line) + 1];
                if (errorLine) {
                    errors.push({
                        file: filePath,
                        line: parseInt(lineNum, 10),
                        column: parseInt(colNum, 10),
                        message: errorLine.trim(),
                        severity: 'error',
                    });
                }
            }
        }
    }
}
/**
 * Get file extension for a language
 */
function getExtension(language) {
    const extensions = {
        typescript: 'ts',
        python: 'py',
        go: 'go',
        java: 'java',
        rust: 'rs',
    };
    return extensions[language];
}
/**
 * Batch validate multiple merge results
 */
async function validateAllMerges(mergeResults, language, outputDir) {
    const results = [];
    for (const result of mergeResults) {
        const validation = await validateMerge(result, language, outputDir);
        results.push(validation);
    }
    return results;
}
//# sourceMappingURL=compiler.js.map