/**
 * Post-merge validator
 * Validates merged output by attempting to compile/type-check it before writing
 */

import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import type { SupportedLanguage, MergeResult } from '../types';

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  language: SupportedLanguage;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate a merge result by compiling the output
 */
export async function validateMerge(
  mergeResult: MergeResult,
  language: SupportedLanguage,
  outputDir: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

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
  } catch (error) {
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
  } finally {
    // Cleanup
    await fs.remove(tmpDir);
  }
}

/**
 * Validate TypeScript code
 */
async function validateTypeScript(
  tmpDir: string,
  file: string,
  errors: ValidationError[],
  warnings: string[]
): Promise<void> {
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
    execSync('npx tsc --noEmit 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
  } catch (error: any) {
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
          severity: severity as 'error' | 'warning',
        });
      }
    }
  }
}

/**
 * Validate Python code
 */
async function validatePython(
  tmpDir: string,
  file: string,
  errors: ValidationError[],
  warnings: string[]
): Promise<void> {
  try {
    // Try py_compile first
    execSync(`python3 -m py_compile ${path.basename(file)} 2>&1`, { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
  } catch (error: any) {
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
    execSync('which mypy', { encoding: 'utf-8', timeout: 5000 });
    try {
      execSync(`mypy --ignore-missing-imports ${path.basename(file)} 2>&1`, { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
    } catch (error: any) {
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
            severity: severity as 'error' | 'warning',
          });
        }
      }
    }
  } catch {
    warnings.push('mypy not installed, skipping type checking');
  }
}

/**
 * Validate Go code
 */
async function validateGo(
  tmpDir: string,
  file: string,
  errors: ValidationError[],
  warnings: string[]
): Promise<void> {
  // Create a go.mod
  const goMod = `module graft-temp\n\ngo 1.21\n`;
  await fs.writeFile(path.join(tmpDir, 'go.mod'), goMod, 'utf-8');

  try {
    execSync('go build . 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
  } catch (error: any) {
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
    execSync('go vet . 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
  } catch (error: any) {
    const output = error.stdout || '';
    warnings.push(`go vet: ${output.trim()}`);
  }
}

/**
 * Validate Java code
 */
async function validateJava(
  tmpDir: string,
  file: string,
  errors: ValidationError[],
  warnings: string[]
): Promise<void> {
  // Check for javac
  try {
    execSync('which javac', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    warnings.push('javac not found, skipping compilation check');
    return;
  }

  try {
    execSync(`javac -d . ${path.basename(file)} 2>&1`, { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 });
  } catch (error: any) {
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
          severity: severity as 'error' | 'warning',
        });
      }
    }
  }
}

/**
 * Validate Rust code
 */
async function validateRust(
  tmpDir: string,
  file: string,
  errors: ValidationError[],
  warnings: string[]
): Promise<void> {
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
    execSync('cargo check 2>&1', { cwd: tmpDir, encoding: 'utf-8', timeout: 60000 });
  } catch (error: any) {
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
function getExtension(language: SupportedLanguage): string {
  const extensions: Record<SupportedLanguage, string> = {
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
export async function validateAllMerges(
  mergeResults: MergeResult[],
  language: SupportedLanguage,
  outputDir: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const result of mergeResults) {
    const validation = await validateMerge(result, language, outputDir);
    results.push(validation);
  }

  return results;
}
