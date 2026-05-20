/**
 * TypeScript SDK Generator
 * Generates idiomatic TypeScript SDKs from OpenAPI specs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { OpenAPISpec, SchemaObject, OperationObject, ParameterObject, SDKConfig } from '../types';
import { getAllOperations, getAllSchemas, getSchemaType } from '../parser/openapi';

/**
 * Generate TypeScript SDK
 */
export async function generateTypeScriptSDK(
  spec: OpenAPISpec,
  config: SDKConfig
): Promise<void> {
  const outputDir = config.output;
  await fs.ensureDir(outputDir);

  const srcDir = path.join(outputDir, 'src');
  await fs.ensureDir(srcDir);
  await fs.ensureDir(path.join(srcDir, 'models'));
  await fs.ensureDir(path.join(srcDir, 'api'));
  await fs.ensureDir(path.join(srcDir, 'utils'));

  await generatePackageJson(spec, config, outputDir);
  await generateTsConfig(outputDir);
  await generateClient(spec, config, srcDir);
  await generateModels(spec, config, srcDir);
  await generateAPIClients(spec, config, srcDir);
  await generateIndex(srcDir);
  await generateErrors(srcDir);
  await generateREADME(spec, config, outputDir);
}

async function generatePackageJson(spec: OpenAPISpec, config: SDKConfig, outputDir: string): Promise<void> {
  const packageName = config.package || `@${spec.info.title.toLowerCase().replace(/\s+/g, '-')}/sdk`;
  const packageJson = {
    name: packageName,
    version: spec.info.version || '0.1.0',
    description: spec.info.description || `SDK for ${spec.info.title}`,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      test: 'jest',
      lint: 'eslint src/**/*.ts',
    },
    dependencies: {
      'cross-fetch': '^4.0.0',
    },
    devDependencies: {
      typescript: '^5.5.0',
      '@types/node': '^22.0.0',
      eslint: '^9.0.0',
    },
    engines: {
      node: '>=18.0.0',
    },
  };

  await fs.writeFile(
    path.join(outputDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf-8'
  );
}

async function generateTsConfig(outputDir: string): Promise<void> {
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      resolveJsonModule: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeFile(path.join(outputDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2), 'utf-8');
}

async function generateClient(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
  const securitySchemes = spec.components?.securitySchemes || {};
  const hasAuth = Object.keys(securitySchemes).length > 0;

  let content = `import fetch from 'cross-fetch';\n`;
  content += `import { GraftSDKError, GraftAPIError } from './utils/errors';\n\n`;
  
  Object.entries(securitySchemes).forEach(([name, scheme]) => {
    if (!('$ref' in scheme)) {
      content += `// Security scheme: ${name} (${scheme.type})\n`;
    }
  });

  content += `\n/**\n`;
  content += ` * ${spec.info.title} - SDK Client\n`;
  content += ` * @version ${spec.info.version}\n`;
  if (spec.info.description) {
    content += ` * ${spec.info.description}\n`;
  }
  content += ` */\n`;
  content += `export interface SDKConfig {\n`;
  content += `  /** API base URL */\n`;
  content += `  baseUrl?: string;\n`;
  if (hasAuth) {
    content += `  /** Authentication token */\n`;
    content += `  apiKey?: string;\n`;
    content += `  /** Bearer token */\n`;
    content += `  bearerToken?: string;\n`;
  }
  content += `  /** Request timeout in milliseconds */\n`;
  content += `  timeout?: number;\n`;
  content += `  /** Custom headers */\n`;
  content += `  headers?: Record<string, string>;\n`;
  content += `  /** Custom fetch implementation */\n`;
  content += `  fetch?: typeof fetch;\n`;
  content += `}\n\n`;

  content += `export class ${toPascalCase(spec.info.title)}Client {\n`;
  content += `  private baseUrl: string;\n`;
  content += `  private headers: Record<string, string>;\n`;
  content += `  private timeout: number;\n`;
  content += `  private fetch: typeof fetch;\n`;
  if (hasAuth) {
    content += `  private apiKey?: string;\n`;
    content += `  private bearerToken?: string;\n`;
  }

  content += `\n  constructor(config: SDKConfig = {}) {\n`;
  content += `    this.baseUrl = config.baseUrl || '${baseUrl}';\n`;
  content += `    this.timeout = config.timeout || 30000;\n`;
  content += `    this.headers = {\n`;
  content += `      'Content-Type': 'application/json',\n`;
  content += `      ...config.headers,\n`;
  content += `    };\n`;
  if (hasAuth) {
    content += `    this.apiKey = config.apiKey;\n`;
    content += `    this.bearerToken = config.bearerToken;\n`;
  }
  content += `    this.fetch = config.fetch || fetch;\n`;
  content += `  }\n\n`;

  if (hasAuth) {
    content += `  setApiKey(apiKey: string): void {\n`;
    content += `    this.apiKey = apiKey;\n`;
    content += `  }\n\n`;
    content += `  setBearerToken(token: string): void {\n`;
    content += `    this.bearerToken = token;\n`;
    content += `  }\n\n`;
  }

  content += `  /**\n`;
  content += `   * Make an authenticated request to the API\n`;
  content += `   */\n`;
  content += `  async request<T>(method: string, path: string, body?: unknown, queryParams?: Record<string, string>): Promise<T> {\n`;
  content += `    const url = new URL(path, this.baseUrl);\n`;
  content += `    \n`;
  content += `    if (queryParams) {\n`;
  content += `      Object.entries(queryParams).forEach(([key, value]) => {\n`;
  content += `        if (value !== undefined && value !== null) {\n`;
  content += `          url.searchParams.append(key, value);\n`;
  content += `        }\n`;
  content += `      });\n`;
  content += `    }\n\n`;
  content += `    const headers: Record<string, string> = { ...this.headers };\n`;
  
  if (hasAuth) {
    content += `    if (this.bearerToken) {\n`;
    content += `      headers['Authorization'] = \`Bearer \${this.bearerToken}\`;\n`;
    content += `    } else if (this.apiKey) {\n`;
    content += `      headers['Authorization'] = \`Bearer \${this.apiKey}\`;\n`;
    content += `    }\n`;
  }

  content += `\n    const controller = new AbortController();\n`;
  content += `    const timeoutId = setTimeout(() => controller.abort(), this.timeout);\n\n`;
  content += `    try {\n`;
  content += `      const response = await this.fetch(url.toString(), {\n`;
  content += `        method,\n`;
  content += `        headers,\n`;
  content += `        body: body ? JSON.stringify(body) : undefined,\n`;
  content += `        signal: controller.signal,\n`;
  content += `      });\n\n`;
  content += `      clearTimeout(timeoutId);\n\n`;
  content += `      if (!response.ok) {\n`;
  content += `        const errorBody = await response.text();\n`;
  content += `        throw new GraftAPIError(\n`;
  content += `          \`HTTP \${response.status}: \${response.statusText}\`,\n`;
  content += `          response.status,\n`;
  content += `          errorBody\n`;
  content += `        );\n`;
  content += `      }\n\n`;
  content += `      if (response.status === 204) {\n`;
  content += `        return undefined as T;\n`;
  content += `      }\n\n`;
  content += `      return await response.json() as T;\n`;
  content += `    } catch (error) {\n`;
  content += `      if (error instanceof GraftAPIError) throw error;\n`;
  content += `      if (error instanceof Error && error.name === 'AbortError') {\n`;
  content += `        throw new GraftSDKError('Request timeout');\n`;
  content += `      }\n`;
  content += `      throw new GraftSDKError(\`Request failed: \${error instanceof Error ? error.message : String(error)}\`);\n`;
  content += `    }\n`;
  content += `  }\n`;
  content += `}\n`;

  await fs.writeFile(path.join(srcDir, 'client.ts'), content, 'utf-8');
}

async function generateModels(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const modelsDir = path.join(srcDir, 'models');
  const schemas = getAllSchemas(spec);

  let content = `/**\n`;
  content += ` * Auto-generated models from ${spec.info.title} OpenAPI spec\n`;
  content += ` * @version ${spec.info.version}\n`;
  content += ` */\n\n`;

  for (const { name, schema } of schemas) {
    if (schema.type === 'object' || schema.properties || schema.allOf) {
      content += generateInterface(name, schema);
    } else if (schema.type === 'string' && schema.enum) {
      content += generateEnum(name, schema);
    } else {
      content += generateTypeAlias(name, schema);
    }
    content += '\n';
  }

  // Generate request/response types for operations
  const operations = getAllOperations(spec);
  for (const { operation, method, path: pathStr } of operations) {
    if (operation.operationId) {
      const opName = toPascalCase(operation.operationId);
      
      if (operation.requestBody || (operation.parameters && operation.parameters.length > 0)) {
        content += `/**\n`;
        content += ` * Request parameters for ${operation.operationId}\n`;
        content += ` */\n`;
        content += `export interface ${opName}Request {\n`;
        
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if ('$ref' in param) continue;
            const p = param as ParameterObject;
            const type = p.schema ? getSchemaType(p.schema, 'typescript') : 'string';
            content += `  /** ${p.description || p.name} */\n`;
            content += `  ${p.name}${p.required ? '' : '?'}: ${type};\n`;
          }
        }
        
        if (operation.requestBody && !('$ref' in operation.requestBody)) {
          const contentType = Object.keys(operation.requestBody.content || {})[0];
          if (contentType) {
            const bodySchema = operation.requestBody.content[contentType]?.schema;
            if (bodySchema) {
              const bodyType = getSchemaType(bodySchema as SchemaObject, 'typescript');
              content += `  /** Request body */\n`;
              content += `  body${operation.requestBody.required ? '' : '?'}: ${bodyType};\n`;
            }
          }
        }
        
        content += `}\n\n`;
      }

      if (operation.responses) {
        const successResponse = Object.entries(operation.responses)
          .find(([code]) => code.startsWith('2'));
        if (successResponse) {
          const [code, response] = successResponse;
          if (!('$ref' in response) && response.content) {
            const contentType = Object.keys(response.content)[0];
            if (contentType && response.content[contentType]?.schema) {
              const responseType = getSchemaType(response.content[contentType].schema as SchemaObject, 'typescript');
              content += `/**\n`;
              content += ` * Response type for ${operation.operationId} (HTTP ${code})\n`;
              content += ` */\n`;
              content += `export type ${opName}Response = ${responseType};\n\n`;
            }
          }
        }
      }
    }
  }

  await fs.writeFile(path.join(modelsDir, 'index.ts'), content, 'utf-8');
}

function generateInterface(name: string, schema: SchemaObject): string {
  const properties: string[] = [];
  
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      if (!('$ref' in subSchema) && subSchema.properties) {
        for (const [propName, propSchema] of Object.entries(subSchema.properties)) {
          const type = getSchemaType(propSchema as SchemaObject, 'typescript');
          const required = subSchema.required?.includes(propName);
          const desc = (propSchema as SchemaObject).description || '';
          properties.push(`  /** ${desc} */\n  ${propName}${required ? '' : '?'}: ${type};`);
        }
      }
    }
  }

  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const type = getSchemaType(propSchema as SchemaObject, 'typescript');
      const required = schema.required?.includes(propName);
      const desc = (propSchema as SchemaObject).description || '';
      properties.push(`  /** ${desc} */\n  ${propName}${required ? '' : '?'}: ${type};`);
    }
  }

  const description = schema.description || `Schema: ${name}`;
  
  return `/**\n * ${description}\n */\nexport interface ${toPascalCase(name)} {\n${properties.join('\n')}\n}\n`;
}

function generateEnum(name: string, schema: SchemaObject): string {
  const description = schema.description || `Enum: ${name}`;
  const members = schema.enum?.map(e => `  ${toPascalCase(String(e))} = '${e}',`).join('\n') || '';
  
  return `/**\n * ${description}\n */\nexport enum ${toPascalCase(name)} {\n${members}\n}\n`;
}

function generateTypeAlias(name: string, schema: SchemaObject): string {
  const type = getSchemaType(schema, 'typescript');
  return `/**\n * ${schema.description || `Type: ${name}`}\n */\nexport type ${toPascalCase(name)} = ${type};\n`;
}

async function generateAPIClients(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const apiDir = path.join(srcDir, 'api');
  const operations = getAllOperations(spec);
  
  const tagGroups: Record<string, typeof operations> = {};
  const untagged: typeof operations = [];
  
  for (const op of operations) {
    const tags = op.operation.tags || [];
    if (tags.length === 0) {
      untagged.push(op);
    } else {
      const tag = tags[0];
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(op);
    }
  }

  for (const [tag, ops] of Object.entries(tagGroups)) {
    const className = toPascalCase(tag) + 'API';
    const fileName = toCamelCase(tag) + '.ts';
    
    let content = `import { ${toPascalCase(spec.info.title)}Client } from '../client';\n`;
    content += `import * as models from '../models';\n\n`;
    
    content += `/**\n * ${tag} API operations\n */\nexport class ${className} {\n`;
    content += `  private client: ${toPascalCase(spec.info.title)}Client;\n\n`;
    content += `  constructor(client: ${toPascalCase(spec.info.title)}Client) {\n`;
    content += `    this.client = client;\n`;
    content += `  }\n\n`;

    for (const { operation, method, path: pathStr } of ops) {
      content += generateMethod(operation, method, pathStr);
    }

    content += `}\n`;
    
    await fs.writeFile(path.join(apiDir, fileName), content, 'utf-8');
  }

  if (untagged.length > 0) {
    let content = `import { ${toPascalCase(spec.info.title)}Client } from '../client';\n`;
    content += `import * as models from '../models';\n\n`;
    
    content += `/**\n * General API operations\n */\nexport class GeneralAPI {\n`;
    content += `  private client: ${toPascalCase(spec.info.title)}Client;\n\n`;
    content += `  constructor(client: ${toPascalCase(spec.info.title)}Client) {\n`;
    content += `    this.client = client;\n`;
    content += `  }\n\n`;

    for (const { operation, method, path: pathStr } of untagged) {
      content += generateMethod(operation, method, pathStr);
    }

    content += `}\n`;
    
    await fs.writeFile(path.join(apiDir, 'general.ts'), content, 'utf-8');
  }
}

function generateMethod(operation: OperationObject, method: string, path: string): string {
  const opId = operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const opName = toCamelCase(opId);
  const requestType = operation.operationId ? `models.${toPascalCase(operation.operationId)}Request` : 'Record<string, unknown>';
  const responseType = operation.operationId ? `models.${toPascalCase(operation.operationId)}Response` : 'unknown';
  
  const hasRequestBody = operation.requestBody && !('$ref' in operation.requestBody);
  const hasQueryParams = operation.parameters?.some(p => !('$ref' in p) && (p as ParameterObject).in === 'query');
  const hasPathParams = operation.parameters?.some(p => !('$ref' in p) && (p as ParameterObject).in === 'path');

  const params: string[] = [];
  
  if (hasRequestBody || hasQueryParams || hasPathParams) {
    params.push(`request: ${requestType}`);
  }

  let methodPath = path;
  if (hasPathParams) {
    methodPath = path.replace(/{(\w+)}/g, '${request.$1}');
  }

  let body = '';
  if (hasRequestBody) {
    body = 'request.body';
  }

  let queryParams = '';
  if (hasQueryParams) {
    queryParams = `, this.extractQueryParams(request)`;
  }

  let content = `  /**\n`;
  content += `   * ${operation.summary || opName}\n`;
  if (operation.description) {
    content += `   * ${operation.description.split('\n').join('\n   * ')}\n`;
  }
  content += `   * @method ${method.toUpperCase()}\n`;
  content += `   * @path ${path}\n`;
  if (operation.deprecated) {
    content += `   * @deprecated\n`;
  }
  content += `   */\n`;

  content += `  // @graft(preserve) id="${opName}-custom"\n`;
  content += `  async ${opName}(${params.join(', ')}): Promise<${responseType}> {\n`;
  content += `    return this.client.request<${responseType}>('${method.toUpperCase()}',\n`;
  content += `      \`${methodPath}\`${body ? `,\n      ${body}` : ''}${queryParams}\n`;
  content += `    );\n`;
  content += `  }\n\n`;

  return content;
}

async function generateErrors(srcDir: string): Promise<void> {
  const errorsDir = path.join(srcDir, 'utils');
  
  let content = `/**\n`;
  content += ` * SDK Error classes\n`;
  content += ` */\n\n`;
  content += `export class GraftSDKError extends Error {\n`;
  content += `  constructor(message: string) {\n`;
  content += `    super(message);\n`;
  content += `    this.name = 'GraftSDKError';\n`;
  content += `  }\n`;
  content += `}\n\n`;
  content += `export class GraftAPIError extends GraftSDKError {\n`;
  content += `  public readonly statusCode: number;\n`;
  content += `  public readonly responseBody: string;\n\n`;
  content += `  constructor(message: string, statusCode: number, responseBody: string) {\n`;
  content += `    super(message);\n`;
  content += `    this.name = 'GraftAPIError';\n`;
  content += `    this.statusCode = statusCode;\n`;
  content += `    this.responseBody = responseBody;\n`;
  content += `  }\n`;
  content += `}\n\n`;
  content += `export class GraftValidationError extends GraftSDKError {\n`;
  content += `  public readonly errors: Record<string, string[]>;\n\n`;
  content += `  constructor(message: string, errors: Record<string, string[]>) {\n`;
  content += `    super(message);\n`;
  content += `    this.name = 'GraftValidationError';\n`;
  content += `    this.errors = errors;\n`;
  content += `  }\n`;
  content += `}\n\n`;
  content += `export class GraftAuthError extends GraftSDKError {\n`;
  content += `  constructor(message: string = 'Authentication failed') {\n`;
  content += `    super(message);\n`;
  content += `    this.name = 'GraftAuthError';\n`;
  content += `  }\n`;
  content += `}\n`;

  await fs.writeFile(path.join(errorsDir, 'errors.ts'), content, 'utf-8');
}

async function generateIndex(srcDir: string): Promise<void> {
  let content = `export { ${toPascalCase('client')}Client, SDKConfig } from './client';\n`;
  content += `export * from './models';\n`;
  content += `export * from './utils/errors';\n\n`;
  content += `// API clients will be re-exported from here\n`;

  await fs.writeFile(path.join(srcDir, 'index.ts'), content, 'utf-8');
}

async function generateREADME(spec: OpenAPISpec, config: SDKConfig, outputDir: string): Promise<void> {
  const packageName = config.package || `@${spec.info.title.toLowerCase().replace(/\s+/g, '-')}/sdk`;
  
  let content = `# ${packageName}\n\n`;
  content += `${spec.info.description || `TypeScript SDK for ${spec.info.title}`}\n\n`;
  content += `## Installation\n\n`;
  content += `\`\`\`bash\n`;
  content += `npm install ${packageName}\n`;
  content += `# or\n`;
  content += `yarn add ${packageName}\n`;
  content += `# or\n`;
  content += `pnpm add ${packageName}\n`;
  content += `\`\`\`\n\n`;
  content += `## Quick Start\n\n`;
  content += `\`\`\`typescript\n`;
  content += `import { Client } from '${packageName}';\n\n`;
  content += `const client = new Client({\n`;
  content += `  apiKey: 'your-api-key',\n`;
  content += `  // or bearerToken: 'your-token'\n`;
  content += `});\n\n`;
  content += `// Make API calls\n`;
  content += `const result = await client.api.operationName({ ... });\n`;
  content += `\`\`\`\n\n`;
  content += `## Preserving Custom Code\n\n`;
  content += `Use \`@graft\` annotations to preserve custom code across regenerations:\n\n`;
  content += `\`\`\`typescript\n`;
  content += `// @graft(preserve) id="custom-validation"\n`;
  content += `async customMethod(request: CustomRequest): Promise<CustomResponse> {\n`;
  content += `  // Your custom implementation here\n`;
  content += `  // This code will survive SDK regeneration\n`;
  content += `}\n`;
  content += `\`\`\`\n\n`;
  content += `## License\n\n`;
  content += `MIT\n`;

  await fs.writeFile(path.join(outputDir, 'README.md'), content, 'utf-8');
}

function toPascalCase(str: string): string {
  return str.replace(/(?:^|[-_])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
