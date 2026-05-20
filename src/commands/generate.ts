/**
 * Generate command - generates SDKs from OpenAPI spec
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { GraftConfig, CLIOptions } from '../types';
import { loadConfig } from '../config/loader';
import { parseSpec } from '../parser/openapi';
import { generateSDK } from '../generators/index';
import { performThreeWayMerge } from '../ast/merge';
import { validateAllMerges } from '../validator/compiler';

/**
 * Run the generate command
 */
export async function generateCommand(options: CLIOptions): Promise<void> {
  const config = await loadConfig(options.config);
  
  // Validate spec exists
  if (!await fs.pathExists(config.spec)) {
    console.error(chalk.red(`OpenAPI spec not found: ${config.spec}`));
    process.exit(1);
  }

  console.log(chalk.blue(`Generating SDKs from ${config.spec}...\n`));

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

  // Generate each SDK
  for (const sdkConfig of config.sdks) {
    const genSpinner = ora(`Generating ${sdkConfig.language} SDK`).start();
    
    try {
      // Step 1: Generate new code ("theirs")
      const theirsDir = path.join(config.baseDir || '.graft/base', 'theirs', sdkConfig.language);
      await fs.ensureDir(theirsDir);

      // Generate fresh SDK to theirs directory
      await generateSDK(spec, {
        ...sdkConfig,
        output: theirsDir,
      });

      genSpinner.text = `Merging ${sdkConfig.language} SDK with custom annotations...`;

      // Step 2: Check if we have existing code to merge
      const oursDir = sdkConfig.output;
      const baseDir = path.join(config.baseDir || '.graft/base', sdkConfig.language);

      if (await fs.pathExists(oursDir)) {
        // There is existing code - perform 3-way merge
        const mergeResults = await performThreeWayMerge(
          baseDir,
          oursDir,
          theirsDir,
          sdkConfig.language,
          sdkConfig.output
        );

        const totalConflicts = mergeResults.reduce((sum, r) => sum + r.conflicts.length, 0);
        const totalAnnotations = mergeResults.reduce((sum, r) => sum + r.annotationsApplied, 0);

        if (totalConflicts > 0) {
          genSpinner.warn(`${sdkConfig.language} SDK generated with ${totalConflicts} merge conflicts`);
          
          for (const result of mergeResults) {
            for (const conflict of result.conflicts) {
              console.log(chalk.yellow(`  ⚠ Conflict: ${conflict.block.annotation.id} (${conflict.block.annotation.type})`));
              if (conflict.resolution) {
                console.log(chalk.gray(`    ${conflict.resolution}`));
              }
            }
          }

          if (options.ci) {
            console.error(chalk.red('\nFailing CI due to unresolved merge conflicts'));
            process.exit(1);
          }
        } else {
          genSpinner.succeed(`${sdkConfig.language} SDK generated (${totalAnnotations} annotations preserved)`);
        }

        // Step 3: Validate merged output
        if (!options.dryRun) {
          const validationResults = await validateAllMerges(mergeResults, sdkConfig.language, sdkConfig.output);
          
          for (const v of validationResults) {
            if (!v.success) {
              console.log(chalk.yellow(`\n  ⚠ Validation issues in ${sdkConfig.language} SDK:`));
              for (const error of v.errors) {
                console.log(chalk.red(`    ${error.file}:${error.line || '?'} - ${error.message}`));
              }
              
              if (options.ci) {
                console.error(chalk.red('\nFailing CI due to validation errors'));
                process.exit(1);
              }
            }
          }
        }
      } else {
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
          console.log(chalk.gray(`  Note: Files matching ${pattern} will be auto-preserved on first modification`));
        }
      }

    } catch (error) {
      genSpinner.fail(`Failed to generate ${sdkConfig.language} SDK: ${error instanceof Error ? error.message : String(error)}`);
      if (options.ci) {
        process.exit(1);
      }
    }
  }

  console.log(chalk.green('\nAll SDKs generated successfully!'));
}
