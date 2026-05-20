/**
 * Graft configuration loader
 * Loads and validates graft.yml configuration files
 */
import type { GraftConfig, SupportedLanguage } from '../types';
/**
 * Load and validate graft.yml configuration
 */
export declare function loadConfig(configPath?: string): Promise<GraftConfig>;
/**
 * Create a default graft.yml configuration file
 */
export declare function createDefaultConfig(outputPath: string, options?: {
    spec?: string;
    language?: SupportedLanguage;
}): Promise<void>;
/**
 * Validate that a configuration has all required fields
 */
export declare function validateConfig(config: GraftConfig): void;
//# sourceMappingURL=loader.d.ts.map