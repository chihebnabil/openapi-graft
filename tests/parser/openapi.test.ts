import * as path from 'path';
import {
  parseSpec,
  getAllOperations,
  getAllSchemas,
  isReference,
  resolveRefName,
  getSchemaType,
  getTags,
  getSecuritySchemes,
  extractMCPTools,
  extractMCPResources,
} from '../../src/parser/openapi';
import type { OpenAPISpec, SchemaObject } from '../../src/types';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

describe('parser/openapi', () => {
  let spec: OpenAPISpec;

  beforeAll(async () => {
    const specPath = path.join(FIXTURES_DIR, 'openapi.yaml');
    spec = await parseSpec(specPath);
  });

  describe('parseSpec', () => {
    it('should parse a valid OpenAPI YAML spec', async () => {
      expect(spec).toBeDefined();
      expect(spec.openapi).toMatch(/^3\./);
      expect(spec.info.title).toBe('Test API');
    });

    it('should throw for non-existent file', async () => {
      await expect(parseSpec('/non/existent/path.yaml')).rejects.toThrow('OpenAPI spec not found');
    });

    it('should throw for unsupported OpenAPI version', async () => {
      const badSpecPath = path.join(__dirname, '..', 'output', 'openapi2.yaml');
      const fs = await import('fs-extra');
      await fs.ensureDir(path.dirname(badSpecPath));
      await fs.writeFile(
        badSpecPath,
        'openapi: 2.0.0\ninfo:\n  title: Bad API\n  version: 1.0.0\npaths: {}\n',
        'utf-8'
      );

      await expect(parseSpec(badSpecPath)).rejects.toThrow('Unsupported OpenAPI version');
    });
  });

  describe('getAllOperations', () => {
    it('should return all operations from the spec', () => {
      const operations = getAllOperations(spec);
      
      expect(operations).toHaveLength(3);
      
      const operationIds = operations.map(op => op.operation.operationId);
      expect(operationIds).toContain('listUsers');
      expect(operationIds).toContain('createUser');
      expect(operationIds).toContain('getUser');
    });

    it('should include path and method info', () => {
      const operations = getAllOperations(spec);
      
      const listOp = operations.find(op => op.operation.operationId === 'listUsers');
      expect(listOp).toBeDefined();
      expect(listOp?.path).toBe('/users');
      expect(listOp?.method).toBe('get');
    });

    it('should return empty array for spec without paths', () => {
      const emptySpec = { openapi: '3.0.0', info: { title: 'Empty', version: '1.0' }, paths: {} } as OpenAPISpec;
      expect(getAllOperations(emptySpec)).toEqual([]);
    });
  });

  describe('getAllSchemas', () => {
    it('should return all schemas', () => {
      const schemas = getAllSchemas(spec);
      
      expect(schemas).toHaveLength(2);
      
      const names = schemas.map(s => s.name);
      expect(names).toContain('User');
      expect(names).toContain('UserInput');
    });

    it('should return empty array for spec without schemas', () => {
      const emptySpec = { openapi: '3.0.0', info: { title: 'Empty', version: '1.0' }, paths: {} } as OpenAPISpec;
      expect(getAllSchemas(emptySpec)).toEqual([]);
    });
  });

  describe('isReference', () => {
    it('should return true for reference objects', () => {
      expect(isReference({ $ref: '#/components/schemas/User' })).toBe(true);
    });

    it('should return false for schema objects', () => {
      expect(isReference({ type: 'string' })).toBe(false);
    });
  });

  describe('resolveRefName', () => {
    it('should extract the last segment of a ref', () => {
      expect(resolveRefName('#/components/schemas/User')).toBe('User');
    });

    it('should return the full string if no slash', () => {
      expect(resolveRefName('User')).toBe('User');
    });
  });

  describe('getSchemaType', () => {
    it('should map primitive types for all languages', () => {
      const stringSchema: SchemaObject = { type: 'string' };
      
      expect(getSchemaType(stringSchema, 'typescript')).toBe('string');
      expect(getSchemaType(stringSchema, 'python')).toBe('str');
      expect(getSchemaType(stringSchema, 'go')).toBe('string');
      expect(getSchemaType(stringSchema, 'java')).toBe('String');
      expect(getSchemaType(stringSchema, 'rust')).toBe('String');
    });

    it('should map integer types', () => {
      const intSchema: SchemaObject = { type: 'integer' };
      
      expect(getSchemaType(intSchema, 'typescript')).toBe('number');
      expect(getSchemaType(intSchema, 'python')).toBe('int');
      expect(getSchemaType(intSchema, 'go')).toBe('int');
    });

    it('should handle int64 format', () => {
      const int64Schema: SchemaObject = { type: 'integer', format: 'int64' };
      
      expect(getSchemaType(int64Schema, 'go')).toBe('int64');
      expect(getSchemaType(int64Schema, 'rust')).toBe('i64');
    });

    it('should handle array types', () => {
      const arraySchema: SchemaObject = {
        type: 'array',
        items: { type: 'string' },
      };
      
      expect(getSchemaType(arraySchema, 'typescript')).toBe('string[]');
      expect(getSchemaType(arraySchema, 'python')).toBe('List[str]');
      expect(getSchemaType(arraySchema, 'go')).toBe('[]string');
      expect(getSchemaType(arraySchema, 'java')).toBe('List<String>');
      expect(getSchemaType(arraySchema, 'rust')).toBe('Vec<String>');
    });

    it('should handle enum types', () => {
      const enumSchema: SchemaObject = {
        type: 'string',
        enum: ['active', 'inactive'],
      };
      
      expect(getSchemaType(enumSchema, 'typescript')).toBe("'active' | 'inactive'");
    });

    it('should handle date-time format', () => {
      const dateSchema: SchemaObject = {
        type: 'string',
        format: 'date-time',
      };
      
      expect(getSchemaType(dateSchema, 'typescript')).toBe('Date');
      expect(getSchemaType(dateSchema, 'python')).toBe('datetime');
      expect(getSchemaType(dateSchema, 'go')).toBe('time.Time');
    });

    it('should handle $ref references', () => {
      const refSchema = { $ref: '#/components/schemas/User' };
      
      expect(getSchemaType(refSchema, 'typescript')).toBe('User');
      expect(getSchemaType(refSchema, 'python')).toBe('user');
      expect(getSchemaType(refSchema, 'go')).toBe('user');
    });

    it('should handle allOf', () => {
      const allOfSchema: SchemaObject = {
        allOf: [
          { $ref: '#/components/schemas/Base' },
          { type: 'object', properties: { extra: { type: 'string' } } },
        ],
      };
      
      const result = getSchemaType(allOfSchema, 'typescript');
      expect(result).toContain('Base');
      expect(result).toContain('&');
    });

    it('should handle additionalProperties', () => {
      const mapSchema: SchemaObject = {
        type: 'object',
        additionalProperties: { type: 'string' },
      };
      
      expect(getSchemaType(mapSchema, 'typescript')).toBe('Record<string, string>');
      expect(getSchemaType(mapSchema, 'go')).toBe('map[string]string');
    });

    it('should return any for unknown types', () => {
      expect(getSchemaType({ type: 'unknown' } as SchemaObject, 'typescript')).toBe('any');
    });
  });

  describe('getTags', () => {
    it('should return all unique tags', () => {
      const tags = getTags(spec);
      
      expect(tags).toContain('users');
    });
  });

  describe('getSecuritySchemes', () => {
    it('should return security schemes', () => {
      const schemes = getSecuritySchemes(spec);
      
      expect(schemes).toHaveLength(1);
      expect(schemes[0].name).toBe('bearerAuth');
      expect(schemes[0].type).toBe('http');
      expect(schemes[0].scheme).toBe('bearer');
    });

    it('should return empty array when no security schemes', () => {
      const emptySpec = { openapi: '3.0.0', info: { title: 'Empty', version: '1.0' }, paths: {} } as OpenAPISpec;
      expect(getSecuritySchemes(emptySpec)).toEqual([]);
    });
  });

  describe('extractMCPTools', () => {
    it('should extract tools from operations', () => {
      const tools = extractMCPTools(spec);
      
      expect(tools.length).toBeGreaterThan(0);
      
      const listTool = tools.find(t => t.operationId === 'listUsers');
      expect(listTool).toBeDefined();
      expect(listTool?.name).toBe('listUsers');
      expect(listTool?.parameters.type).toBe('object');
    });

    it('should include path parameters in tool parameters', () => {
      const tools = extractMCPTools(spec);
      const getTool = tools.find(t => t.operationId === 'getUser');
      
      expect(getTool?.parameters.properties).toHaveProperty('id');
    });

    it('should include request body in tool parameters', () => {
      const tools = extractMCPTools(spec);
      const createTool = tools.find(t => t.operationId === 'createUser');
      
      expect(createTool?.parameters.properties).toHaveProperty('body');
    });
  });

  describe('extractMCPResources', () => {
    it('should extract GET operations as resources', () => {
      const resources = extractMCPResources(spec);
      
      const getResource = resources.find(r => r.name === 'getUser');
      expect(getResource).toBeDefined();
      expect(getResource?.uri).toBe('api://getUser');
    });

    it('should extract schemas as resources', () => {
      const resources = extractMCPResources(spec);
      
      const schemaResource = resources.find(r => r.name === 'User');
      expect(schemaResource).toBeDefined();
      expect(schemaResource?.uri).toBe('schema://User');
    });
  });
});
