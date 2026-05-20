/**
 * Generator dispatcher
 * Routes to the appropriate language generator based on SDK config
 */
import type { OpenAPISpec, SDKConfig, SupportedLanguage } from '../types';
/**
 * Generate SDK for a specific language
 */
export declare function generateSDK(spec: OpenAPISpec, config: SDKConfig): Promise<void>;
/**
 * Check if a language is supported
 */
export declare function isLanguageSupported(language: string): language is SupportedLanguage;
//# sourceMappingURL=index.d.ts.map