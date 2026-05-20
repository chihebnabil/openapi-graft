/**
 * OpenAPI spec parser
 * Parses and resolves OpenAPI 3.x specifications
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPISpec, SchemaObject, ReferenceObject, OperationObject, ParameterObject } from '../types';

/**
 * Parse an OpenAPI specification from a file path
 * Supports JSON and YAML formats
 */
export async function parseSpec(specPath: string): Promise<OpenAPISpec> {
  if (!await fs.pathExists(specPath)) {
    throw new Error(`OpenAPI spec not found: ${specPath}`);
  }

  // Use SwaggerParser to resolve all $ref references
  const dereferenced = await SwaggerParser.dereference(specPath) as OpenAPISpec;
  
  // Also load the raw spec to preserve original structure
  const rawContent = await fs.readFile(specPath, 'utf-8');
  const rawSpec = (specPath.endsWith('.yaml') || specPath.endsWith('.yml'))
    ? yaml.load(rawContent) as OpenAPISpec
    : JSON.parse(rawContent) as OpenAPISpec;

  // Validate OpenAPI version
  const version = dereferenced.openapi;
  if (!version || !version.startsWith('3.')) {
    throw new Error(`Unsupported OpenAPI version: ${version || 'undefined'}. Only 3.x is supported.`);
  }

  // Merge: dereferenced components with original structure
  return {
    ...rawSpec,
    ...dereferenced,
    components: dereferenced.components,
  };
}

/**
 * Get all operations from the spec as a flat array with path and method info
 */
export function getAllOperations(spec: OpenAPISpec): Array<{
  path: string;
  method: string;
  operation: OperationObject;
}> {
  const operations: Array<{ path: string; method: string; operation: OperationObject }> = [];

  if (!spec.paths) return operations;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue;
    
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;
    
    for (const method of methods) {
      const operation = pathItem[method];
      if (operation) {
        operations.push({
          path,
          method,
          operation: operation as OperationObject,
        });
      }
    }
  }

  return operations;
}

/**
 * Get all schemas from the spec components
 */
export function getAllSchemas(spec: OpenAPISpec): Array<{
  name: string;
  schema: SchemaObject;
}> {
  const schemas: Array<{ name: string; schema: SchemaObject }> = [];

  if (!spec.components?.schemas) return schemas;

  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    schemas.push({
      name,
      schema: schema as SchemaObject,
    });
  }

  return schemas;
}

/**
 * Check if a schema is a reference
 */
export function isReference(schema: SchemaObject | ReferenceObject): schema is ReferenceObject {
  return '$ref' in schema;
}

/**
 * Resolve a reference to a schema name
 */
export function resolveRefName(ref: string): string {
  return ref.split('/').pop() || ref;
}

/**
 * Get schema type information for code generation
 */
export function getSchemaType(schema: SchemaObject | ReferenceObject, language: string): string {
  if (isReference(schema)) {
    const name = resolveRefName(schema.$ref);
    return formatTypeName(name, language);
  }

  if (schema.allOf) {
    // Merge allOf schemas
    return schema.allOf.map(s => getSchemaType(s as SchemaObject, language)).join(' & ');
  }

  if (schema.oneOf) {
    return schema.oneOf.map(s => getSchemaType(s as SchemaObject, language)).join(' | ');
  }

  if (schema.anyOf) {
    return schema.anyOf.map(s => getSchemaType(s as SchemaObject, language)).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      if (schema.enum) {
        return schema.enum.map(e => `'${e}'`).join(' | ');
      }
      if (schema.format === 'date-time') {
        if (language === 'typescript') return 'Date';
        if (language === 'python') return 'datetime';
        if (language === 'java') return 'OffsetDateTime';
        if (language === 'go') return 'time.Time';
        if (language === 'rust') return 'chrono::DateTime<chrono::Utc>';
      }
      if (schema.format === 'date') {
        if (language === 'typescript') return 'Date';
        if (language === 'python') return 'date';
        if (language === 'java') return 'LocalDate';
        if (language === 'go') return 'time.Time';
        if (language === 'rust') return 'chrono::NaiveDate';
      }
      return mapPrimitiveType('string', language);
    case 'integer':
      if (schema.format === 'int64') {
        if (language === 'typescript') return 'number';
        if (language === 'go') return 'int64';
        if (language === 'rust') return 'i64';
      }
      return mapPrimitiveType('integer', language);
    case 'number':
      if (schema.format === 'double' || schema.format === 'float') {
        if (language === 'go') return 'float64';
        if (language === 'rust') return 'f64';
      }
      return mapPrimitiveType('number', language);
    case 'boolean':
      return mapPrimitiveType('boolean', language);
    case 'array':
      if (schema.items) {
        const itemType = getSchemaType(schema.items as SchemaObject, language);
        if (language === 'python') return `List[${itemType}]`;
        if (language === 'java') return `List<${itemType}>`;
        if (language === 'go') return `[]${itemType}`;
        if (language === 'rust') return `Vec<${itemType}>`;
        return `${itemType}[]`;
      }
      return mapPrimitiveType('array', language);
    case 'object':
      if (schema.additionalProperties && schema.additionalProperties !== true) {
        const valueType = getSchemaType(schema.additionalProperties as SchemaObject, language);
        if (language === 'typescript') return `Record<string, ${valueType}>`;
        if (language === 'python') return `Dict[str, ${valueType}]`;
        if (language === 'go') return `map[string]${valueType}`;
        if (language === 'java') return `Map<String, ${valueType}>`;
        if (language === 'rust') return `HashMap<String, ${valueType}>`;
      }
      if (schema.properties) {
        // Inline object type
        const props = Object.entries(schema.properties)
          .map(([key, value]) => {
            const propType = getSchemaType(value as SchemaObject, language);
            const optional = !schema.required?.includes(key);
            if (language === 'typescript') return `${key}${optional ? '?' : ''}: ${propType}`;
            return `${key}: ${propType}`;
          })
          .join('; ');
        if (language === 'typescript') return `{ ${props} }`;
      }
      return mapPrimitiveType('object', language);
    default:
      return 'any';
  }
}

/**
 * Map primitive OpenAPI types to language-specific types
 */
function mapPrimitiveType(openapiType: string, language: string): string {
  const typeMap: Record<string, Record<string, string>> = {
    string: {
      typescript: 'string',
      python: 'str',
      go: 'string',
      java: 'String',
      rust: 'String',
    },
    integer: {
      typescript: 'number',
      python: 'int',
      go: 'int',
      java: 'Integer',
      rust: 'i32',
    },
    number: {
      typescript: 'number',
      python: 'float',
      go: 'float64',
      java: 'Double',
      rust: 'f64',
    },
    boolean: {
      typescript: 'boolean',
      python: 'bool',
      go: 'bool',
      java: 'Boolean',
      rust: 'bool',
    },
    array: {
      typescript: 'any[]',
      python: 'List',
      go: '[]interface{}',
      java: 'List<Object>',
      rust: 'Vec<serde_json::Value>',
    },
    object: {
      typescript: 'Record<string, any>',
      python: 'Dict[str, Any]',
      go: 'map[string]interface{}',
      java: 'Map<String, Object>',
      rust: 'serde_json::Value',
    },
  };

  return typeMap[openapiType]?.[language] || 'any';
}

/**
 * Format a schema/type name for a given language
 */
function formatTypeName(name: string, language: string): string {
  if (language === 'python' || language === 'go') {
    // snake_case
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
  // PascalCase for others
  return name;
}

/**
 * Get all tags defined in the spec
 */
export function getTags(spec: OpenAPISpec): string[] {
  const tagSet = new Set<string>();
  
  // From explicit tags
  if (spec.tags) {
    for (const tag of spec.tags) {
      tagSet.add(tag.name);
    }
  }

  // From operations
  const operations = getAllOperations(spec);
  for (const op of operations) {
    if (op.operation.tags) {
      for (const tag of op.operation.tags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet);
}

/**
 * Get security schemes from the spec
 */
export function getSecuritySchemes(spec: OpenAPISpec): Array<{
  name: string;
  type: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
}> {
  const schemes: Array<{
    name: string;
    type: string;
    scheme?: string;
    bearerFormat?: string;
    flows?: Record<string, unknown>;
  }> = [];

  if (!spec.components?.securitySchemes) return schemes;

  for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
    if (!('$ref' in scheme)) {
      schemes.push({
        name,
        type: scheme.type,
        scheme: scheme.scheme,
        bearerFormat: scheme.bearerFormat,
        flows: scheme.flows as Record<string, unknown>,
      });
    }
  }

  return schemes;
}

/**
 * Extract MCP tools from OpenAPI operations
 */
export function extractMCPTools(spec: OpenAPISpec): Array<{
  name: string;
  description: string;
  parameters: SchemaObject;
  operationId: string;
}> {
  const operations = getAllOperations(spec);
  
  return operations
    .filter(op => op.operation.operationId)
    .map(op => {
      const parameters: SchemaObject = {
        type: 'object',
        properties: {},
        required: [],
      };

      // Path and query parameters
      if (op.operation.parameters) {
        for (const param of op.operation.parameters) {
          if ('$ref' in param) continue;
          const p = param as ParameterObject;
          parameters.properties![p.name] = p.schema || { type: 'string' };
          if (p.required) {
            parameters.required!.push(p.name);
          }
        }
      }

      // Request body
      if (op.operation.requestBody && !('$ref' in op.operation.requestBody)) {
        const body = op.operation.requestBody;
        const jsonContent = body.content?.['application/json'];
        if (jsonContent?.schema) {
          parameters.properties!['body'] = jsonContent.schema as SchemaObject;
        }
      }

      return {
        name: op.operation.operationId!,
        description: op.operation.summary || op.operation.description || `${op.method.toUpperCase()} ${op.path}`,
        parameters,
        operationId: op.operation.operationId!,
      };
    });
}

/**
 * Extract MCP resources from OpenAPI spec
 */
export function extractMCPResources(spec: OpenAPISpec): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}> {
  const resources: Array<{ uri: string; name: string; description: string; mimeType?: string }> = [];
  const operations = getAllOperations(spec);

  for (const op of operations) {
    if (op.method === 'get' && op.operation.operationId) {
      resources.push({
        uri: `api://${op.operation.operationId}`,
        name: op.operation.operationId,
        description: op.operation.summary || op.operation.description || `GET ${op.path}`,
        mimeType: 'application/json',
      });
    }
  }

  // Add schemas as resources
  const schemas = getAllSchemas(spec);
  for (const schema of schemas) {
    resources.push({
      uri: `schema://${schema.name}`,
      name: schema.name,
      description: schema.schema.description || `Schema: ${schema.name}`,
      mimeType: 'application/json',
    });
  }

  return resources;
}
