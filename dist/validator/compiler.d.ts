/**
 * Post-merge validator
 * Validates merged output by attempting to compile/type-check it before writing
 */
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
export declare function validateMerge(mergeResult: MergeResult, language: SupportedLanguage, outputDir: string): Promise<ValidationResult>;
/**
 * Batch validate multiple merge results
 */
export declare function validateAllMerges(mergeResults: MergeResult[], language: SupportedLanguage, outputDir: string): Promise<ValidationResult[]>;
//# sourceMappingURL=compiler.d.ts.map