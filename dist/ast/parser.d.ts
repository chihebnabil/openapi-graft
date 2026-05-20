/**
 * Tree-sitter based AST parser for multiple languages
 * Provides language-aware parsing for the 3-way merge engine
 */
import type { ASTNode, SupportedLanguage, GraftAnnotation } from '../types';
/**
 * Parse source code into an AST
 */
export declare function parseSource(source: string, language: SupportedLanguage, filePath?: string): Promise<ASTNode>;
/**
/**
 * Extract @graft annotations from source code
 * Supports multiple annotation styles:
 *   // @graft(preserve) id="custom-method"
 *   # @graft(replace) id="override"
 *   block comment @graft(extend) id="addon"
 *   /// @graft(preserve) id="rust-block"
 */
export declare function extractAnnotations(source: string, language: SupportedLanguage): Array<{
    annotation: GraftAnnotation;
    startLine: number;
    endLine: number;
    blockText: string;
}>;
/**
 * Inject @graft annotations into source code
 */
export declare function injectAnnotation(source: string, annotation: GraftAnnotation, blockStartLine: number, language: SupportedLanguage): string;
/**
 * Serialize an AST back to source code
 */
export declare function serializeAST(node: ASTNode): string;
/**
 * Find a node by annotation ID in the AST
 */
export declare function findNodeByAnnotationId(node: ASTNode, annotationId: string): ASTNode | null;
//# sourceMappingURL=parser.d.ts.map