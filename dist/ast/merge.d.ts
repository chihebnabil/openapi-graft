/**
 * AST-level 3-way merge engine
 * Merges generated code with preserved custom annotations
 */
import type { SupportedLanguage, MergeResult } from '../types';
/**
 * Perform a 3-way merge on all SDK files
 */
export declare function performThreeWayMerge(baseDir: string, oursDir: string, theirsDir: string, language: SupportedLanguage, outputDir: string): Promise<MergeResult[]>;
//# sourceMappingURL=merge.d.ts.map