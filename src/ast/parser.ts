/**
 * Tree-sitter based AST parser for multiple languages
 * Provides language-aware parsing for the 3-way merge engine
 */

import Parser from 'tree-sitter';
import type { ASTNode, SupportedLanguage, GraftAnnotation } from '../types';

// Lazy-load language parsers to avoid issues if not all are installed
const languageCache: Map<SupportedLanguage, any> = new Map();

async function loadLanguageParser(language: SupportedLanguage): Promise<any> {
  if (languageCache.has(language)) {
    return languageCache.get(language);
  }

  let parser: any;
  
  try {
    switch (language) {
      case 'typescript':
        parser = await import('tree-sitter-typescript');
        languageCache.set(language, parser.typescript || parser.default || parser);
        break;
      case 'python':
        parser = await import('tree-sitter-python');
        languageCache.set(language, parser.default || parser);
        break;
      case 'go':
        parser = await import('tree-sitter-go');
        languageCache.set(language, parser.default || parser);
        break;
      case 'java':
        parser = await import('tree-sitter-java');
        languageCache.set(language, parser.default || parser);
        break;
      case 'rust':
        parser = await import('tree-sitter-rust');
        languageCache.set(language, parser.default || parser);
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  } catch (error) {
    // Fallback: create a minimal parser
    console.warn(`Warning: Could not load tree-sitter parser for ${language}. Using regex-based parsing as fallback.`);
    languageCache.set(language, null);
  }

  return languageCache.get(language);
}

/**
 * Parse source code into an AST
 */
export async function parseSource(
  source: string,
  language: SupportedLanguage,
  filePath?: string
): Promise<ASTNode> {
  const langParser = await loadLanguageParser(language);

  if (langParser) {
    try {
      const parser = new Parser();
      parser.setLanguage(langParser);
      const tree = parser.parse(source);
      return convertToASTNode(tree.rootNode);
    } catch (error) {
      console.warn(`Tree-sitter parsing failed for ${filePath || 'unknown'}, using fallback`);
    }
  }

  // Fallback: regex-based block detection
  return fallbackParse(source, language);
}

/**
 * Convert a Tree-sitter node to our ASTNode format
 */
function convertToASTNode(node: Parser.SyntaxNode): ASTNode {
  const astNode: ASTNode = {
    type: node.type,
    startPosition: { row: node.startPosition.row, column: node.startPosition.column },
    endPosition: { row: node.endPosition.row, column: node.endPosition.column },
    text: node.text,
    children: [],
  };

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      astNode.children.push(convertToASTNode(child));
    }
  }

  return astNode;
}

/**
 * Fallback parser using regex-based block detection
 * Handles common constructs across all supported languages
 */
function fallbackParse(source: string, language: SupportedLanguage): ASTNode {
  const lines = source.split('\n');
  const blocks: ASTNode[] = [];
  const currentBlock: { start: number; content: string[] } | null = null;

  const blockPatterns: Record<SupportedLanguage, RegExp[]> = {
    typescript: [
      /^(export\s+)?(class|interface|type|function|const|let|var|enum|namespace|module)\s+\w+/,
      /^\s*@\w+/, // Decorators
    ],
    python: [
      /^(class|def|async\s+def)\s+\w+/,
      /^\s*@\w+/, // Decorators
    ],
    go: [
      /^(type|func|var|const)\s+\w+/,
    ],
    java: [
      /^(public|private|protected|static|final|abstract|class|interface|enum|record|@)/,
    ],
    rust: [
      /^(pub\s+)?(fn|struct|enum|trait|impl|type|const|static|use|mod)\s/,
      /^#\[.*\]/,
    ],
  };

  const patterns = blockPatterns[language];
  const indentStack: { indent: number; node: ASTNode }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^(\s*)/)?.[1].length || 0;
    
    // Check if this line starts a new block
    const isBlockStart = patterns.some(p => p.test(line));
    
    if (isBlockStart) {
      // Pop blocks that have ended (lower or equal indent)
      while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= indent) {
        indentStack.pop();
      }

      const blockNode: ASTNode = {
        type: detectBlockType(line, language),
        startPosition: { row: i, column: indent },
        endPosition: { row: i, column: line.length },
        text: line,
        children: [],
      };

      if (indentStack.length > 0) {
        indentStack[indentStack.length - 1].node.children.push(blockNode);
      } else {
        blocks.push(blockNode);
      }

      indentStack.push({ indent, node: blockNode });
    } else if (indentStack.length > 0) {
      // Append to current block
      const current = indentStack[indentStack.length - 1].node;
      current.text += '\n' + line;
      current.endPosition = { row: i, column: line.length };
    }
  }

  return {
    type: 'source_file',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: lines.length - 1, column: lines[lines.length - 1]?.length || 0 },
    text: source,
    children: blocks,
  };
}

/**
 * Detect the block type from a line of code
 */
function detectBlockType(line: string, language: SupportedLanguage): string {
  const trimmed = line.trim();
  
  switch (language) {
    case 'typescript':
      if (trimmed.startsWith('class')) return 'class_declaration';
      if (trimmed.startsWith('interface')) return 'interface_declaration';
      if (trimmed.startsWith('function') || trimmed.includes('=>')) return 'function_declaration';
      if (trimmed.startsWith('const') || trimmed.startsWith('let') || trimmed.startsWith('var')) return 'variable_declaration';
      if (trimmed.startsWith('type')) return 'type_alias_declaration';
      if (trimmed.startsWith('enum')) return 'enum_declaration';
      return 'statement';
    
    case 'python':
      if (trimmed.startsWith('class')) return 'class_definition';
      if (trimmed.startsWith('def') || trimmed.startsWith('async def')) return 'function_definition';
      return 'statement';
    
    case 'go':
      if (trimmed.startsWith('func')) return 'function_declaration';
      if (trimmed.startsWith('type')) return 'type_declaration';
      if (trimmed.startsWith('struct')) return 'struct_declaration';
      return 'statement';
    
    case 'java':
      if (trimmed.includes('class')) return 'class_declaration';
      if (trimmed.includes('interface')) return 'interface_declaration';
      if (trimmed.includes('enum')) return 'enum_declaration';
      return 'statement';
    
    case 'rust':
      if (trimmed.includes('fn ')) return 'function_item';
      if (trimmed.includes('struct')) return 'struct_item';
      if (trimmed.includes('enum')) return 'enum_item';
      if (trimmed.includes('trait')) return 'trait_item';
      if (trimmed.includes('impl')) return 'impl_item';
      return 'statement';
    
    default:
      return 'statement';
  }
}

/**
/**
 * Extract @graft annotations from source code
 * Supports multiple annotation styles:
 *   // @graft(preserve) id="custom-method"
 *   # @graft(replace) id="override"
 *   block comment @graft(extend) id="addon"
 *   /// @graft(preserve) id="rust-block"
 */
export function extractAnnotations(source: string, language: SupportedLanguage): Array<{
  annotation: GraftAnnotation;
  startLine: number;
  endLine: number;
  blockText: string;
}> {
  const annotations: Array<{
    annotation: GraftAnnotation;
    startLine: number;
    endLine: number;
    blockText: string;
  }> = [];

  const lines = source.split('\n');
  const commentPatterns: Record<SupportedLanguage, RegExp> = {
    typescript: /\/\/\s*@graft\((\w+)\)\s+id="([^"]+)"/,
    python: /#\s*@graft\((\w+)\)\s+id="([^"]+)"/,
    go: /\/\/\s*@graft\((\w+)\)\s+id="([^"]+)"/,
    java: /\/\/\s*@graft\((\w+)\)\s+id="([^"]+)"|\/\*\s*@graft\((\w+)\)\s+id="([^"]+)"\s*\*\//,
    rust: /\/\/\/\s*@graft\((\w+)\)\s+id="([^"]+)"|\/\/\s*@graft\((\w+)\)\s+id="([^"]+)"/,
  };

  const pattern = commentPatterns[language];
  const blockDelimiters: Record<SupportedLanguage, { start: RegExp; end: RegExp }> = {
    typescript: { start: /[{}]\s*$/, end: /^\s*\}/ },
    python: { start: /:\s*$/, end: /^(?!\s)/ },
    go: { start: /[{}]\s*$/, end: /^\s*\}/ },
    java: { start: /[{]\s*$/, end: /^\s*\}/ },
    rust: { start: /[{]\s*$/, end: /^\s*\}/ },
  };

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (match) {
      const type = (match[1] || match[3]) as 'preserve' | 'replace' | 'extend';
      const id = match[2] || match[4];

      // Find the annotated block
      let blockStart = i + 1;
      let blockEnd = blockStart;
      const delimiters = blockDelimiters[language];
      
      // Find block start (skip blank lines and comments)
      while (blockStart < lines.length && (lines[blockStart].trim() === '' || lines[blockStart].trim().startsWith('//') || lines[blockStart].trim().startsWith('#') || lines[blockStart].trim().startsWith('/*') || lines[blockStart].trim().startsWith('*'))) {
        blockStart++;
      }

      // Find block end based on language
      if (language === 'python') {
        // Python uses indentation
        const baseIndent = lines[blockStart].match(/^(\s*)/)?.[1].length || 0;
        blockEnd = blockStart + 1;
        while (blockEnd < lines.length) {
          const line = lines[blockEnd];
          const indent = line.match(/^(\s*)/)?.[1].length || 0;
          if (line.trim() !== '' && indent <= baseIndent && blockEnd > blockStart) break;
          blockEnd++;
        }
      } else {
        // C-style braces
        let braceCount = 0;
        blockEnd = blockStart;
        while (blockEnd < lines.length) {
          for (const char of lines[blockEnd]) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          if (braceCount === 0 && lines[blockEnd].includes('{')) {
            blockEnd++;
            break;
          }
          blockEnd++;
        }
      }

      const blockText = lines.slice(blockStart, blockEnd).join('\n');

      annotations.push({
        annotation: {
          type,
          id,
          language,
        },
        startLine: blockStart,
        endLine: blockEnd,
        blockText,
      });
    }
  }

  return annotations;
}

/**
 * Inject @graft annotations into source code
 */
export function injectAnnotation(
  source: string,
  annotation: GraftAnnotation,
  blockStartLine: number,
  language: SupportedLanguage
): string {
  const lines = source.split('\n');
  const commentPrefix: Record<SupportedLanguage, string> = {
    typescript: `// @graft(${annotation.type}) id="${annotation.id}"`,
    python: `# @graft(${annotation.type}) id="${annotation.id}"`,
    go: `// @graft(${annotation.type}) id="${annotation.id}"`,
    java: `// @graft(${annotation.type}) id="${annotation.id}"`,
    rust: `/// @graft(${annotation.type}) id="${annotation.id}"`,
  };

  lines.splice(blockStartLine, 0, commentPrefix[language]);
  return lines.join('\n');
}

/**
 * Serialize an AST back to source code
 */
export function serializeAST(node: ASTNode): string {
  return node.text;
}

/**
 * Find a node by annotation ID in the AST
 */
export function findNodeByAnnotationId(node: ASTNode, annotationId: string): ASTNode | null {
  if (node.metadata?.annotationId === annotationId) {
    return node;
  }
  for (const child of node.children) {
    const found = findNodeByAnnotationId(child, annotationId);
    if (found) return found;
  }
  return null;
}
