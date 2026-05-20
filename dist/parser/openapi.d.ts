/**
 * OpenAPI spec parser
 * Parses and resolves OpenAPI 3.x specifications
 */
import type { OpenAPISpec, SchemaObject, ReferenceObject, OperationObject } from '../types';
/**
 * Parse an OpenAPI specification from a file path
 * Supports JSON and YAML formats
 */
export declare function parseSpec(specPath: string): Promise<OpenAPISpec>;
/**
 * Get all operations from the spec as a flat array with path and method info
 */
export declare function getAllOperations(spec: OpenAPISpec): Array<{
    path: string;
    method: string;
    operation: OperationObject;
}>;
/**
 * Get all schemas from the spec components
 */
export declare function getAllSchemas(spec: OpenAPISpec): Array<{
    name: string;
    schema: SchemaObject;
}>;
/**
 * Check if a schema is a reference
 */
export declare function isReference(schema: SchemaObject | ReferenceObject): schema is ReferenceObject;
/**
 * Resolve a reference to a schema name
 */
export declare function resolveRefName(ref: string): string;
/**
 * Get schema type information for code generation
 */
export declare function getSchemaType(schema: SchemaObject | ReferenceObject, language: string): string;
/**
 * Get all tags defined in the spec
 */
export declare function getTags(spec: OpenAPISpec): string[];
/**
 * Get security schemes from the spec
 */
export declare function getSecuritySchemes(spec: OpenAPISpec): Array<{
    name: string;
    type: string;
    scheme?: string;
    bearerFormat?: string;
    flows?: Record<string, unknown>;
}>;
/**
 * Extract MCP tools from OpenAPI operations
 */
export declare function extractMCPTools(spec: OpenAPISpec): Array<{
    name: string;
    description: string;
    parameters: SchemaObject;
    operationId: string;
}>;
/**
 * Extract MCP resources from OpenAPI spec
 */
export declare function extractMCPResources(spec: OpenAPISpec): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}>;
//# sourceMappingURL=openapi.d.ts.map