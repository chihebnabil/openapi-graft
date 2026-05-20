/**
 * Graft configuration loader
 * Loads and validates graft.yml configuration files
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { GraftConfig, SDKConfig, MCPConfig, SupportedLanguage } from '../types';

const supportedLanguages: SupportedLanguage[] = ['typescript', 'python', 'go', 'java', 'rust'];

const sdkConfigSchema = z.object({
  language: z.enum(supportedLanguages as [string, ...string[]]).transform(s => s as SupportedLanguage),
  output: z.string(),
  package: z.string().optional(),
  preserve: z.array(z.string()).optional(),
  templates: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

const mcpConfigSchema = z.object({
  enabled: z.boolean(),
  output: z.string(),
  name: z.string().optional(),
  version: z.string().optional(),
});

const graftConfigSchema = z.object({
  spec: z.string(),
  sdks: z.array(sdkConfigSchema),
  mcp: mcpConfigSchema.optional(),
  baseDir: z.string().optional(),
});

/**
 * Load and validate graft.yml configuration
 */
export async function loadConfig(configPath?: string): Promise<GraftConfig> {
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

      const config: GraftConfig = {
        spec: path.resolve(path.dirname(searchPath), result.data.spec),
        sdks: result.data.sdks.map((sdk: z.infer<typeof sdkConfigSchema>): SDKConfig => ({
          language: sdk.language as SupportedLanguage,
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

  throw new Error(
    `No graft.yml configuration found. Searched:\n${searchPaths.map(p => `  - ${p}`).join('\n')}\n\n` +
    `Run 'graft init' to create a new configuration, or specify --config <path>.`
  );
}

/**
 * Create a default graft.yml configuration file
 */
export async function createDefaultConfig(outputPath: string, options?: { spec?: string; language?: SupportedLanguage }): Promise<void> {
  const language = options?.language || 'typescript';
  const spec = options?.spec || './openapi.json';
  
  const config: Record<string, unknown> = {
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
export function validateConfig(config: GraftConfig): void {
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
