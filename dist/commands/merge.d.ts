/**
 * Merge command - manually trigger a 3-way merge
 */
import type { CLIOptions, SupportedLanguage } from '../types';
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
export declare function mergeCommand(options: MergeCommandOptions): Promise<void>;
export {};
//# sourceMappingURL=merge.d.ts.map