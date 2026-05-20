/**
 * AST-level 3-way merge engine
 * Merges generated code with preserved custom annotations
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import type { 
  SupportedLanguage, 
  GraftAnnotation, 
  MergeResult, 
  MergeConflict,
  AnnotatedBlock,
  ASTNode 
} from '../types';
import { parseSource, extractAnnotations, injectAnnotation, serializeAST } from './parser';

/**
 * File content for 3-way merge
 */
interface MergeFile {
  path: string;
  base: string;    // Previous clean generation
  ours: string;    // Current working SDK with custom code
  theirs: string;  // New generation from updated OpenAPI spec
  language: SupportedLanguage;
}

/**
 * Perform a 3-way merge on all SDK files
 */
export async function performThreeWayMerge(
  baseDir: string,
  oursDir: string,
  theirsDir: string,
  language: SupportedLanguage,
  outputDir: string
): Promise<MergeResult[]> {
  const results: MergeResult[] = [];

  // Find all files in all three directories
  const baseFiles = await findSourceFiles(baseDir, language);
  const oursFiles = await findSourceFiles(oursDir, language);
  const theirsFiles = await findSourceFiles(theirsDir, language);

  // Build file sets
  const allFiles = new Set([
    ...baseFiles.map(f => path.relative(baseDir, f)),
    ...oursFiles.map(f => path.relative(oursDir, f)),
    ...theirsFiles.map(f => path.relative(theirsDir, f)),
  ]);

  for (const relativePath of allFiles) {
    const mFile: MergeFile = {
      path: relativePath,
      base: await readFileSafe(path.join(baseDir, relativePath)),
      ours: await readFileSafe(path.join(oursDir, relativePath)),
      theirs: await readFileSafe(path.join(theirsDir, relativePath)),
      language,
    };

    const result = await mergeSingleFile(mFile);
    
    // Write merged output
    const outputPath = path.join(outputDir, relativePath);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, result.output, 'utf-8');

    results.push(result);
  }

  return results;
}

/**
 * Perform 3-way merge on a single file
 */
async function mergeSingleFile(file: MergeFile): Promise<MergeResult> {
  // If no base (new file), take theirs
  if (!file.base && file.theirs) {
    return {
      success: true,
      output: file.theirs,
      conflicts: [],
      annotationsApplied: 0,
    };
  }

  // If no theirs (deleted file), take ours with annotations
  if (!file.theirs && file.ours) {
    return {
      success: true,
      output: file.ours,
      conflicts: [],
      annotationsApplied: 0,
    };
  }

  // If no ours, take theirs
  if (!file.ours && file.theirs) {
    return {
      success: true,
      output: file.theirs,
      conflicts: [],
      annotationsApplied: 0,
    };
  }

  // Extract annotations from "ours" (the working copy with custom code)
  const annotations = extractAnnotations(file.ours, file.language);

  if (annotations.length === 0) {
    // No custom annotations - take theirs (new generation)
    return {
      success: true,
      output: file.theirs,
      conflicts: [],
      annotationsApplied: 0,
    };
  }

  // Parse all three versions
  const [baseAST, oursAST, theirsAST] = await Promise.all([
    parseSource(file.base, file.language, file.path),
    parseSource(file.ours, file.language, file.path),
    parseSource(file.theirs, file.language, file.path),
  ]);

  // Start with theirs (new generation) as base
  let mergedOutput = file.theirs;
  let annotationsApplied = 0;
  const conflicts: MergeConflict[] = [];

  // Process each annotation
  for (const annotationInfo of annotations) {
    const { annotation, blockText } = annotationInfo;

    try {
      const applyResult = await applyAnnotation(
        mergedOutput,
        file.base,
        file.ours,
        annotation,
        blockText,
        file.language
      );

      if (applyResult.conflict) {
        conflicts.push(applyResult.conflict);
      } else {
        mergedOutput = applyResult.output;
        annotationsApplied++;
      }
    } catch (error) {
      conflicts.push({
        block: {
          annotation,
          node: oursAST,
          originalText: blockText,
        },
        baseText: file.base,
        oursText: blockText,
        theirsText: file.theirs,
        resolved: false,
      } as MergeConflict);
    }
  }

  return {
    success: conflicts.length === 0,
    output: mergedOutput,
    conflicts,
    annotationsApplied,
  };
}

/**
 * Apply a single annotation to the merge result
 */
async function applyAnnotation(
  currentOutput: string,
  base: string,
  ours: string,
  annotation: GraftAnnotation,
  blockText: string,
  language: SupportedLanguage
): Promise<{ output: string; conflict?: MergeConflict }> {
  switch (annotation.type) {
    case 'preserve':
      return applyPreserveAnnotation(currentOutput, ours, annotation, blockText, language);
    
    case 'replace':
      return applyReplaceAnnotation(currentOutput, ours, annotation, blockText, language);
    
    case 'extend':
      return applyExtendAnnotation(currentOutput, ours, base, annotation, blockText, language);
    
    default:
      return { output: currentOutput };
  }
}

/**
 * Apply a @graft(preserve) annotation
 * Keeps the annotated block exactly as-is from "ours"
 */
function applyPreserveAnnotation(
  currentOutput: string,
  ours: string,
  annotation: GraftAnnotation,
  blockText: string,
  language: SupportedLanguage
): { output: string; conflict?: MergeConflict } {
  // Find the annotated block in ours
  const annotationLine = findAnnotationLine(ours, annotation);
  
  if (!annotationLine) {
    return {
      output: currentOutput,
      conflict: createConflict(annotation, currentOutput, ours, currentOutput, blockText, 'Annotation not found in source'),
    };
  }

  // Find where to insert in the new output
  // Strategy: find the containing class/function in "theirs" and insert there
  const insertionPoint = findInsertionPoint(currentOutput, annotation, blockText, language);
  
  if (insertionPoint === -1) {
    // Cannot find insertion point - append at end
    return {
      output: currentOutput + '\n\n' + formatPreservedBlock(annotation, blockText, language),
    };
  }

  // Insert the preserved block
  const lines = currentOutput.split('\n');
  const prefix = lines.slice(0, insertionPoint + 1);
  const suffix = lines.slice(insertionPoint + 1);
  
  const preservedBlock = formatPreservedBlock(annotation, blockText, language);
  
  const newOutput = [
    ...prefix,
    '',
    preservedBlock,
    '',
    ...suffix,
  ].join('\n');

  return { output: newOutput };
}

/**
 * Apply a @graft(replace) annotation
 * Replaces the matching block in "theirs" with the annotated block from "ours"
 */
function applyReplaceAnnotation(
  currentOutput: string,
  ours: string,
  annotation: GraftAnnotation,
  blockText: string,
  language: SupportedLanguage
): { output: string; conflict?: MergeConflict } {
  // Find the block to replace in current output
  const blockSignature = getBlockSignature(blockText, language);
  
  if (!blockSignature) {
    return {
      output: currentOutput,
      conflict: createConflict(annotation, currentOutput, ours, currentOutput, blockText, 'Cannot determine block signature'),
    };
  }

  // Find and replace in current output
  const lines = currentOutput.split('\n');
  const blockRange = findBlockRange(lines, blockSignature, language);

  if (!blockRange) {
    // Block not found - insert as new
    return applyPreserveAnnotation(currentOutput, ours, annotation, blockText, language);
  }

  const prefix = lines.slice(0, blockRange.start);
  const suffix = lines.slice(blockRange.end);
  const replacedBlock = formatPreservedBlock(annotation, blockText, language);

  return {
    output: [...prefix, replacedBlock, ...suffix].join('\n'),
  };
}

/**
 * Apply a @graft(extend) annotation
 * Extends the matching block by merging content
 */
function applyExtendAnnotation(
  currentOutput: string,
  ours: string,
  base: string,
  annotation: GraftAnnotation,
  blockText: string,
  language: SupportedLanguage
): { output: string; conflict?: MergeConflict } {
  // Find the block to extend
  const blockSignature = getBlockSignature(blockText, language);
  
  if (!blockSignature) {
    return { output: currentOutput };
  }

  const lines = currentOutput.split('\n');
  const blockRange = findBlockRange(lines, blockSignature, language);

  if (!blockRange) {
    return { output: currentOutput };
  }

  // Extract the base block and the extension
  const existingBlock = lines.slice(blockRange.start, blockRange.end).join('\n');
  
  // Merge: keep structure from new generation, add custom content
  const mergedBlock = mergeBlocks(existingBlock, blockText, language);

  const prefix = lines.slice(0, blockRange.start);
  const suffix = lines.slice(blockRange.end);

  return {
    output: [...prefix, mergedBlock, ...suffix].join('\n'),
  };
}

/**
 * Format a preserved block with its annotation comment
 */
function formatPreservedBlock(annotation: GraftAnnotation, blockText: string, language: SupportedLanguage): string {
  const commentPrefix: Record<SupportedLanguage, string> = {
    typescript: `// @graft(${annotation.type}) id="${annotation.id}"`,
    python: `# @graft(${annotation.type}) id="${annotation.id}"`,
    go: `// @graft(${annotation.type}) id="${annotation.id}"`,
    java: `// @graft(${annotation.type}) id="${annotation.id}"`,
    rust: `/// @graft(${annotation.type}) id="${annotation.id}"`,
  };

  return `${commentPrefix[language]}\n${blockText}`;
}

/**
 * Find the line number of an annotation in source code
 */
function findAnnotationLine(source: string, annotation: GraftAnnotation): number {
  const lines = source.split('\n');
  const pattern = new RegExp(`@graft\(\\w+\)\\s+id="${annotation.id}"`);
  
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

/**
 * Find the insertion point in the new generated code
 * Returns the line number where the block should be inserted
 */
function findInsertionPoint(
  output: string,
  annotation: GraftAnnotation,
  blockText: string,
  language: SupportedLanguage
): number {
  const lines = output.split('\n');
  const signature = getBlockSignature(blockText, language);

  if (!signature) return -1;

  // Find a class or function with matching name pattern
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(signature.className || signature.methodName || '')) {
      // Find the closing of this block
      return findBlockEnd(lines, i, language);
    }
  }

  return -1;
}

/**
 * Find the end line of a block
 */
function findBlockEnd(lines: string[], startLine: number, language: SupportedLanguage): number {
  if (language === 'python') {
    const baseIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0;
    for (let i = startLine + 1; i < lines.length; i++) {
      const indent = lines[i].match(/^(\s*)/)?.[1].length || 0;
      if (lines[i].trim() !== '' && indent <= baseIndent) {
        return i - 1;
      }
    }
    return lines.length - 1;
  } else {
    let braceCount = 0;
    for (let i = startLine; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      if (braceCount === 0 && lines[i].includes('{')) {
        return i;
      }
    }
    return lines.length - 1;
  }
}

/**
 * Get the signature (identifying info) of a code block
 */
function getBlockSignature(blockText: string, language: SupportedLanguage): { className?: string; methodName?: string; type?: string } | null {
  const lines = blockText.split('\n');
  const firstLine = lines[0].trim();

  const patterns: Record<SupportedLanguage, RegExp[]> = {
    typescript: [
      /(?:export\s+)?class\s+(\w+)/,
      /(?:export\s+)?interface\s+(\w+)/,
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)/,
      /(?:public|private|protected|static)?\s*(\w+)\s*\([^)]*\)\s*[:{]/,
    ],
    python: [
      /class\s+(\w+)/,
      /def\s+(\w+)/,
    ],
    go: [
      /func\s+(?:\([^)]*\)\s+)?(\w+)/,
      /type\s+(\w+)/,
    ],
    java: [
      /(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?[\w<>]+\s+(\w+)\s*\(/,
      /class\s+(\w+)/,
    ],
    rust: [
      /(?:pub\s+)?fn\s+(\w+)/,
      /(?:pub\s+)?struct\s+(\w+)/,
      /(?:pub\s+)?impl\s+(?:\w+\s+for\s+)?(\w+)/,
    ],
  };

  for (const pattern of patterns[language]) {
    const match = firstLine.match(pattern);
    if (match) {
      return {
        className: match[1],
        methodName: match[1],
        type: firstLine.includes('class') ? 'class' : firstLine.includes('interface') ? 'interface' : 'function',
      };
    }
  }

  return null;
}

/**
 * Find the range of a block in source lines
 */
function findBlockRange(lines: string[], signature: { className?: string; methodName?: string }, language: SupportedLanguage): { start: number; end: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if ((signature.className && lines[i].includes(signature.className)) ||
        (signature.methodName && lines[i].includes(signature.methodName))) {
      const end = findBlockEnd(lines, i, language);
      return { start: i, end: end + 1 };
    }
  }
  return null;
}

/**
 * Merge two blocks for @graft(extend)
 */
function mergeBlocks(existingBlock: string, customBlock: string, language: SupportedLanguage): string {
  // Simple strategy: append custom methods/properties to existing block
  // More sophisticated strategies can be implemented per-language
  
  if (language === 'typescript' || language === 'go' || language === 'java' || language === 'rust') {
    // C-style: find the closing brace and insert before it
    const lines = existingBlock.split('\n');
    let lastBrace = lines.length - 1;
    
    while (lastBrace >= 0 && lines[lastBrace].trim() !== '}') {
      lastBrace--;
    }

    if (lastBrace > 0) {
      const customContent = extractBlockContent(customBlock, language);
      lines.splice(lastBrace, 0, '', ...customContent.split('\n'));
      return lines.join('\n');
    }
  }

  if (language === 'python') {
    // Python: append with proper indentation
    const baseIndent = getIndentation(existingBlock);
    const customContent = extractBlockContent(customBlock, language)
      .split('\n')
      .map(line => line.trim() ? baseIndent + '    ' + line : line)
      .join('\n');
    return existingBlock + '\n' + customContent;
  }

  return existingBlock;
}

/**
 * Extract the inner content of a block (without signature line)
 */
function extractBlockContent(blockText: string, language: SupportedLanguage): string {
  const lines = blockText.split('\n');
  
  if (language === 'python') {
    // Skip class/def line, keep rest
    return lines.slice(1).join('\n');
  }

  // For C-style languages, skip signature and braces
  let start = 0;
  while (start < lines.length && !lines[start].includes('{')) {
    start++;
  }
  start++; // Skip opening brace

  let end = lines.length - 1;
  while (end >= 0 && lines[end].trim() === '}') {
    end--;
  }

  return lines.slice(start, end + 1).join('\n');
}

/**
 * Get base indentation from a block
 */
function getIndentation(blockText: string): string {
  const lines = blockText.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const match = line.match(/^(\s*)/);
      return match ? match[1] : '';
    }
  }
  return '';
}

/**
 * Create a conflict record
 */
function createConflict(
  annotation: GraftAnnotation,
  baseText: string,
  oursText: string,
  theirsText: string,
  blockText: string,
  reason: string
): MergeConflict {
  return {
    block: {
      annotation,
      node: { type: 'unknown', startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 0 }, text: blockText, children: [] },
      originalText: blockText,
    },
    baseText,
    oursText,
    theirsText,
    resolved: false,
    resolution: reason,
  };
}

/**
 * Find all source files for a language
 */
async function findSourceFiles(dir: string, language: SupportedLanguage): Promise<string[]> {
  if (!await fs.pathExists(dir)) {
    return [];
  }

  const extensions: Record<SupportedLanguage, string> = {
    typescript: 'ts',
    python: 'py',
    go: 'go',
    java: 'java',
    rust: 'rs',
  };

  const pattern = path.posix.join(dir.replace(/\\/g, '/'), '**', `*.${extensions[language]}`);
  return glob(pattern);
}

/**
 * Read a file safely, return empty string if not found
 */
async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}
