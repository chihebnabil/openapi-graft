/**
 * MCP (Model Context Protocol) Server Generator
 * Generates MCP server scaffolding from OpenAPI specs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { OpenAPISpec, MCPConfig, SchemaObject, OperationObject, ParameterObject, MCPTool, MCPResource, GeneratedFile } from '../types';
import { getAllOperations, getAllSchemas, extractMCPTools, extractMCPResources } from '../parser/openapi';

/**
 * Generate MCP server scaffolding
 */
export async function generateMCPServer(
  spec: OpenAPISpec,
  config: MCPConfig
): Promise<void> {
  const outputDir = config.output;
  await fs.ensureDir(outputDir);

  const serverName = config.name || spec.info.title;
  const version = config.version || spec.info.version || '0.1.0';

  // Ensure output directories exist
  await fs.ensureDir(path.join(outputDir, 'src'));

  // Generate package.json
  await generateMCPPackageJson(spec, config, outputDir);

  // Generate TypeScript MCP server
  await generateMCPServerTs(spec, config, outputDir);

  // Generate tools
  await generateMCPTools(spec, config, outputDir);

  // Generate resources
  await generateMCPResources(spec, config, outputDir);

  // Generate types
  await generateMCPTypes(spec, config, outputDir);

  // Generate README
  await generateMCPREADME(spec, config, outputDir);

  // Generate tsconfig
  await generateMCPTsConfig(outputDir);
}

async function generateMCPPackageJson(spec: OpenAPISpec, config: MCPConfig, outputDir: string): Promise<void> {
  const serverName = config.name || spec.info.title.toLowerCase().replace(/\s+/g, '-');
  
  const packageJson = {
    name: `${serverName}-mcp-server`,
    version: config.version || spec.info.version || '0.1.0',
    description: `MCP server for ${spec.info.title}`,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    bin: {
      'mcp-server': 'dist/index.js',
    },
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
      dev: 'ts-node src/index.ts',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
      'cross-fetch': '^4.0.0',
    },
    devDependencies: {
      typescript: '^5.5.0',
      '@types/node': '^22.0.0',
      'ts-node': '^10.9.0',
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

async function generateMCPTsConfig(outputDir: string): Promise<void> {
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
      resolveJsonModule: true,
    },
    include: ['src/**/*'],
  };

  await fs.writeFile(
    path.join(outputDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2),
    'utf-8'
  );
}

async function generateMCPServerTs(spec: OpenAPISpec, config: MCPConfig, outputDir: string): Promise<void> {
  const srcDir = path.join(outputDir, 'src');
  const tools = extractMCPTools(spec);
  const resources = extractMCPResources(spec);
  
  let content = `#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ${tools.map(t => toCamelCase(t.name)).join(', ')} } from './tools';

/**
 * ${spec.info.title} MCP Server
 * ${spec.info.description || ''}
 * @version ${spec.info.version || '1.0.0'}
 */

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || '${spec.servers?.[0]?.url || 'https://api.example.com'}';
const API_KEY = process.env.API_KEY;

// Create server instance
const server = new Server(
  {
    name: '${config.name || spec.info.title.toLowerCase().replace(/\s+/g, '-')}',
    version: '${config.version || spec.info.version || '1.0.0'}',
  },
  {
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {
        listChanged: false,
        subscribe: false,
      },
      prompts: {
        listChanged: false,
      },
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
${tools.map(tool => `      {
        name: '${tool.name}',
        description: '${tool.description?.replace(/'/g, "\\'") || ''}',
        inputSchema: ${JSON.stringify(tool.parameters, null, 6).split('\n').map((l, i) => i === 0 ? l : '      ' + l).join('\n')},
      },`).join('\n')}
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
${tools.map(tool => `      case '${tool.name}':
        return await ${toCamelCase(tool.name)}(args, API_BASE_URL, API_KEY);`).join('\n')}
      default:
        throw new Error(\`Unknown tool: \${name}\`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: \`Error: \${error instanceof Error ? error.message : String(error)}\`,
        },
      ],
      isError: true,
    };
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
${resources.map(r => `      {
        uri: '${r.uri}',
        name: '${r.name}',
        description: '${r.description?.replace(/'/g, "\\'") || ''}',
        mimeType: '${r.mimeType || 'application/json'}',
      },`).join('\n')}
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    const resource = findResource(uri);
    if (!resource) {
      throw new Error(\`Resource not found: \${uri}\`);
    }

    const data = await fetchResourceData(uri, API_BASE_URL, API_KEY);
    
    return {
      contents: [
        {
          uri,
          mimeType: resource.mimeType || 'application/json',
          text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(\`Failed to read resource \${uri}: \${error instanceof Error ? error.message : String(error)}\`);
  }
});

// Prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'api_explorer',
        description: 'Explore the ${spec.info.title} API',
        arguments: [
          {
            name: 'endpoint',
            description: 'Specific endpoint to explore',
            required: false,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'api_explorer') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: \`I want to explore the ${spec.info.title} API.\${args?.endpoint ? \` Focus on the \${args.endpoint} endpoint.\` : ''}\n\nAvailable endpoints:\n${getAllOperations(spec).map(op => `- \${op.method.toUpperCase()} \${op.path}: \${op.operation.summary || ''}`).join('\n')}\`,
          },
        },
      ],
    };
  }

  throw new Error(\`Unknown prompt: \${name}\`);
});

// Helper functions
function findResource(uri: string) {
  const resources = [
${resources.map(r => `    { uri: '${r.uri}', name: '${r.name}', description: '${r.description?.replace(/'/g, "\\'") || ''}', mimeType: '${r.mimeType || 'application/json'}' },`).join('\n')}
  ];
  return resources.find(r => r.uri === uri);
}

async function fetchResourceData(uri: string, baseUrl: string, apiKey?: string) {
  // Simple proxy to the API
  const path = uri.replace('api://', '/').replace('schema://', '/');
  const url = \`\${baseUrl}\${path}\`;
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = \`Bearer \${apiKey}\`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }
  return response.json();
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${spec.info.title} MCP Server running on stdio');
}

main().catch(console.error);
`;

  await fs.writeFile(path.join(srcDir, 'index.ts'), content, 'utf-8');
  await fs.chmod(path.join(srcDir, 'index.ts'), '755');
}

async function generateMCPTools(spec: OpenAPISpec, config: MCPConfig, outputDir: string): Promise<void> {
  const srcDir = path.join(outputDir, 'src');
  const tools = extractMCPTools(spec);
  const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';

  let content = `import fetch from 'cross-fetch';

const API_BASE_URL = process.env.API_BASE_URL || '${baseUrl}';

async function apiRequest(method: string, path: string, body?: unknown, queryParams?: Record<string, string>, apiKey?: string) {
  const url = new URL(path, API_BASE_URL);
  if (queryParams) {
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.append(k, v);
    });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = \`Bearer \${apiKey}\`;

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }

  if (response.status === 204) return null;
  return response.json();
}

`;

  for (const tool of tools) {
    const op = getOperationForTool(spec, tool.operationId);
    const method = op?.method || 'get';
    const pathStr = op?.path || '/';
    
    content += `export async function ${toCamelCase(tool.name)}(args: any, baseUrl?: string, apiKey?: string) {
  try {
    const result = await apiRequest('${method.toUpperCase()}', '${pathStr}', args, undefined, apiKey);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: \`Error calling ${tool.name}: \${error instanceof Error ? error.message : String(error)}\`,
        },
      ],
      isError: true,
    };
  }
}

`;
  }

  await fs.writeFile(path.join(srcDir, 'tools.ts'), content, 'utf-8');
}

async function generateMCPResources(spec: OpenAPISpec, config: MCPConfig, outputDir: string): Promise<void> {
  const srcDir = path.join(outputDir, 'src');
  const resources = extractMCPResources(spec);

  let content = `export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export const resources: Resource[] = [
${resources.map(r => `  {
    uri: '${r.uri}',
    name: '${r.name}',
    description: '${r.description?.replace(/'/g, "\\'") || ''}',
    mimeType: '${r.mimeType || 'application/json'}',
  },`).join('\n')}
];
`;

  await fs.writeFile(path.join(srcDir, 'resources.ts'), content, 'utf-8');
}

async function generateMCPTypes(spec: OpenAPISpec, config: MCPConfig, outputDir: string): Promise<void> {
  const srcDir = path.join(outputDir, 'src');

  let content = `/**
 * MCP Server Types
 * Auto-generated from ${spec.info.title} OpenAPI spec
 */

export interface ToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      uri: string;
      mimeType: string;
      text: string;
    };
  }>;
  isError?: boolean;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      uri: string;
      mimeType: string;
      text: string;
    };
  };
}

export interface PromptResult {
  messages: PromptMessage[];
  description?: string;
}
`;

  await fs.writeFile(path.join(srcDir, 'types.ts'), content, 'utf-8');
}

async function generateMCPREADME(spec: OpenAPISpec, config: MCPConfig, outputDir: string): Promise<void> {
  const serverName = config.name || spec.info.title.toLowerCase().replace(/\s+/g, '-');
  
  const content = `# ${spec.info.title} MCP Server

${spec.info.description || `MCP server for ${spec.info.title}`}

## Installation

\`\`\`bash
npm install -g ${serverName}-mcp-server
\`\`\`

## Configuration

Set environment variables:

\`\`\`bash
export API_BASE_URL=${spec.servers?.[0]?.url || 'https://api.example.com'}
export API_KEY=your-api-key
\`\`\`

## Claude Desktop Integration

Add to your Claude Desktop config (\`~/Library/Application Support/Claude/claude_desktop_config.json\`):

\`\`\`json
{
  "mcpServers": {
    "${serverName}": {
      "command": "npx",
      "args": ["${serverName}-mcp-server"],
      "env": {
        "API_BASE_URL": "${spec.servers?.[0]?.url || 'https://api.example.com'}",
        "API_KEY": "your-api-key"
      }
    }
  }
}
\`\`\`

## Available Tools

${extractMCPTools(spec).map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}

## Available Resources

${extractMCPResources(spec).map(r => `- **${r.uri}**: ${r.description}`).join('\n')}

## Development

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## License

MIT
`;

  await fs.writeFile(path.join(outputDir, 'README.md'), content, 'utf-8');
}

// Utility functions
function toCamelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}

function getOperationForTool(spec: OpenAPISpec, operationId: string): { method: string; path: string; operation: OperationObject } | undefined {
  const operations = getAllOperations(spec);
  return operations.find(op => op.operation.operationId === operationId);
}
