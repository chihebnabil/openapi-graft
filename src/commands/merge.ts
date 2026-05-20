/**
 * Merge command - manually trigger a 3-way merge
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { CLIOptions, SupportedLanguage } from '../types';
import { performThreeWayMerge } from '../ast/merge';
import { validateAllMerges } from '../validator/compiler';

interface MergeCommandOptions extends CLIOptions {
  base?: string;
  ours?: string;
  theirs?: string;
  language: SupportedLanguage;
  output: string;
}

/**
 * Run the merge command
 */
export async function mergeCommand(options: MergeCommandOptions): Promise<void> {
  const { base, ours, theirs, language, output } = options;

  // Validate paths
  if (!ours || !theirs) {
    console.error(chalk.red('Missing required paths:'));
    if (!ours) console.error(chalk.red('  --ours <path>  (current working copy with custom code)'));
    if (!theirs) console.error(chalk.red('  --theirs <path>  (new generated code)'));
    process.exit(1);
  }

  if (!await fs.pathExists(ours)) {
    console.error(chalk.red(`Ours path does not exist: ${ours}`));
    process.exit(1);
  }

  if (!await fs.pathExists(theirs)) {
    console.error(chalk.red(`Theirs path does not exist: ${theirs}`));
    process.exit(1);
  }

  // Base defaults to theirs if not provided (first generation)
  const baseDir = base || theirs;

  console.log(chalk.blue(`Performing 3-way merge for ${language}...\n`));
  console.log(chalk.gray(`  Base: ${baseDir}`));
  console.log(chalk.gray(`  Ours: ${ours}`));
  console.log(chalk.gray(`  Theirs: ${theirs}`));
  console.log(chalk.gray(`  Output: ${output}\n`));

  const mergeSpinner = ora('Merging files').start();

  try {
    const mergeResults = await performThreeWayMerge(baseDir, ours, theirs, language, output);

    const totalFiles = mergeResults.length;
    const totalConflicts = mergeResults.reduce((sum, r) => sum + r.conflicts.length, 0);
    const totalAnnotations = mergeResults.reduce((sum, r) => sum + r.annotationsApplied, 0);

    if (totalConflicts > 0) {
      mergeSpinner.warn(`Merge completed with ${totalConflicts} conflicts`);
      
      for (const result of mergeResults) {
        for (const conflict of result.conflicts) {
          console.log(chalk.yellow(`\n  ⚠ Conflict in annotation: ${conflict.block.annotation.id}`));
          console.log(chalk.gray(`    Type: ${conflict.block.annotation.type}`));
          if (conflict.resolution) {
            console.log(chalk.gray(`    Reason: ${conflict.resolution}`));
          }
        }
      }

      if (options.ci) {
        console.error(chalk.red('\nFailing CI due to unresolved merge conflicts'));
        process.exit(1);
      }
    } else {
      mergeSpinner.succeed(`Merged ${totalFiles} files (${totalAnnotations} annotations preserved)`);
    }

    // Validate merged output
    const validateSpinner = ora('Validating merged output').start();
    const validationResults = await validateAllMerges(mergeResults, language, output);
    
    const validationErrors = validationResults.filter(v => !v.success);
    if (validationErrors.length > 0) {
      validateSpinner.warn('Validation completed with issues');
      
      for (const v of validationErrors) {
        for (const error of v.errors) {
          console.log(chalk.red(`  ${error.file}:${error.line || '?'} - ${error.message}`));
        }
      }

      if (options.ci) {
        console.error(chalk.red('\nFailing CI due to validation errors'));
        process.exit(1);
      }
    } else {
      validateSpinner.succeed('Validation passed');
    }

    console.log(chalk.green(`\nMerge output written to: ${output}`));

  } catch (error) {
    mergeSpinner.fail(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
    if (options.ci) {
      process.exit(1);
    }
  }
}
