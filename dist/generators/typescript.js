"use strict";
/**
 * TypeScript SDK Generator
 * Generates idiomatic TypeScript SDKs from OpenAPI specs
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTypeScriptSDK = generateTypeScriptSDK;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const openapi_1 = require("../parser/openapi");
/**
 * Generate TypeScript SDK
 */
async function generateTypeScriptSDK(spec, config) {
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
async function generatePackageJson(spec, config, outputDir) {
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
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
}
async function generateTsConfig(outputDir) {
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
async function generateClient(spec, config, srcDir) {
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
async function generateModels(spec, config, srcDir) {
    const modelsDir = path.join(srcDir, 'models');
    const schemas = (0, openapi_1.getAllSchemas)(spec);
    let content = `/**\n`;
    content += ` * Auto-generated models from ${spec.info.title} OpenAPI spec\n`;
    content += ` * @version ${spec.info.version}\n`;
    content += ` */\n\n`;
    for (const { name, schema } of schemas) {
        if (schema.type === 'object' || schema.properties || schema.allOf) {
            content += generateInterface(name, schema);
        }
        else if (schema.type === 'string' && schema.enum) {
            content += generateEnum(name, schema);
        }
        else {
            content += generateTypeAlias(name, schema);
        }
        content += '\n';
    }
    // Generate request/response types for operations
    const operations = (0, openapi_1.getAllOperations)(spec);
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
                        if ('$ref' in param)
                            continue;
                        const p = param;
                        const type = p.schema ? (0, openapi_1.getSchemaType)(p.schema, 'typescript') : 'string';
                        content += `  /** ${p.description || p.name} */\n`;
                        content += `  ${p.name}${p.required ? '' : '?'}: ${type};\n`;
                    }
                }
                if (operation.requestBody && !('$ref' in operation.requestBody)) {
                    const contentType = Object.keys(operation.requestBody.content || {})[0];
                    if (contentType) {
                        const bodySchema = operation.requestBody.content[contentType]?.schema;
                        if (bodySchema) {
                            const bodyType = (0, openapi_1.getSchemaType)(bodySchema, 'typescript');
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
                            const responseType = (0, openapi_1.getSchemaType)(response.content[contentType].schema, 'typescript');
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
function generateInterface(name, schema) {
    const properties = [];
    if (schema.allOf) {
        for (const subSchema of schema.allOf) {
            if (!('$ref' in subSchema) && subSchema.properties) {
                for (const [propName, propSchema] of Object.entries(subSchema.properties)) {
                    const type = (0, openapi_1.getSchemaType)(propSchema, 'typescript');
                    const required = subSchema.required?.includes(propName);
                    const desc = propSchema.description || '';
                    properties.push(`  /** ${desc} */\n  ${propName}${required ? '' : '?'}: ${type};`);
                }
            }
        }
    }
    if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const type = (0, openapi_1.getSchemaType)(propSchema, 'typescript');
            const required = schema.required?.includes(propName);
            const desc = propSchema.description || '';
            properties.push(`  /** ${desc} */\n  ${propName}${required ? '' : '?'}: ${type};`);
        }
    }
    const description = schema.description || `Schema: ${name}`;
    return `/**\n * ${description}\n */\nexport interface ${toPascalCase(name)} {\n${properties.join('\n')}\n}\n`;
}
function generateEnum(name, schema) {
    const description = schema.description || `Enum: ${name}`;
    const members = schema.enum?.map(e => `  ${toPascalCase(String(e))} = '${e}',`).join('\n') || '';
    return `/**\n * ${description}\n */\nexport enum ${toPascalCase(name)} {\n${members}\n}\n`;
}
function generateTypeAlias(name, schema) {
    const type = (0, openapi_1.getSchemaType)(schema, 'typescript');
    return `/**\n * ${schema.description || `Type: ${name}`}\n */\nexport type ${toPascalCase(name)} = ${type};\n`;
}
async function generateAPIClients(spec, config, srcDir) {
    const apiDir = path.join(srcDir, 'api');
    const operations = (0, openapi_1.getAllOperations)(spec);
    const tagGroups = {};
    const untagged = [];
    for (const op of operations) {
        const tags = op.operation.tags || [];
        if (tags.length === 0) {
            untagged.push(op);
        }
        else {
            const tag = tags[0];
            if (!tagGroups[tag])
                tagGroups[tag] = [];
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
function generateMethod(operation, method, path) {
    const opId = operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const opName = toCamelCase(opId);
    const requestType = operation.operationId ? `models.${toPascalCase(operation.operationId)}Request` : 'Record<string, unknown>';
    const responseType = operation.operationId ? `models.${toPascalCase(operation.operationId)}Response` : 'unknown';
    const hasRequestBody = operation.requestBody && !('$ref' in operation.requestBody);
    const hasQueryParams = operation.parameters?.some(p => !('$ref' in p) && p.in === 'query');
    const hasPathParams = operation.parameters?.some(p => !('$ref' in p) && p.in === 'path');
    let params = [];
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
async function generateErrors(srcDir) {
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
async function generateIndex(srcDir) {
    let content = `export { ${toPascalCase('client')}Client, SDKConfig } from './client';\n`;
    content += `export * from './models';\n`;
    content += `export * from './utils/errors';\n\n`;
    content += `// API clients will be re-exported from here\n`;
    await fs.writeFile(path.join(srcDir, 'index.ts'), content, 'utf-8');
}
async function generateREADME(spec, config, outputDir) {
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
function toPascalCase(str) {
    return str.replace(/(?:^|[-_])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}
function toCamelCase(str) {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
//# sourceMappingURL=typescript.js.map