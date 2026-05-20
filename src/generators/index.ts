/**
 * Generator dispatcher
 * Routes to the appropriate language generator based on SDK config
 */

import type { OpenAPISpec, SDKConfig, SupportedLanguage } from '../types';
import { generateTypeScriptSDK } from './typescript';
import { generatePythonSDK } from './python';
import { generateGoSDK } from './golang';
import { generateJavaSDK } from './java';
import { generateRustSDK } from './rust';

/**
 * Generate SDK for a specific language
 */
export async function generateSDK(
  spec: OpenAPISpec,
  config: SDKConfig
): Promise<void> {
  const generator = getGenerator(config.language);
  await generator(spec, config);
}

/**
 * Get the generator function for a specific language
 */
function getGenerator(language: SupportedLanguage) {
  const generators: Record<SupportedLanguage, (spec: OpenAPISpec, config: SDKConfig) => Promise<void>> = {
    typescript: generateTypeScriptSDK,
    python: generatePythonSDK,
    go: generateGoSDK,
    java: generateJavaSDK,
    rust: generateRustSDK,
  };

  const generator = generators[language];
  if (!generator) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return generator;
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return ['typescript', 'python', 'go', 'java', 'rust'].includes(language);
}
