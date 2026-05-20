/**
 * Init command - creates a new graft.yml configuration
 */
import type { SupportedLanguage } from '../types';
interface InitOptions {
    language?: SupportedLanguage;
    spec?: string;
    yes?: boolean;
}
/**
 * Run the init command
 */
export declare function initCommand(options?: InitOptions): Promise<void>;
export {};
//# sourceMappingURL=init.d.ts.map