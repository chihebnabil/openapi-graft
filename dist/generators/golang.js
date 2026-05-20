"use strict";
/**
 * Go SDK Generator
 * Generates idiomatic Go SDKs from OpenAPI specs
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
exports.generateGoSDK = generateGoSDK;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const openapi_1 = require("../parser/openapi");
/**
 * Generate Go SDK
 */
async function generateGoSDK(spec, config) {
    const outputDir = config.output;
    await fs.ensureDir(outputDir);
    const pkgName = config.package || toGoPackageName(spec.info.title);
    await fs.ensureDir(path.join(outputDir, 'models'));
    await fs.ensureDir(path.join(outputDir, 'api'));
    await generateGoMod(spec, config, pkgName, outputDir);
    await generateGoClient(spec, config, pkgName, outputDir);
    await generateGoModels(spec, config, pkgName, outputDir);
    await generateGoAPI(spec, config, pkgName, outputDir);
    await generateGoErrors(pkgName, outputDir);
    await generateGoREADME(spec, config, outputDir);
}
async function generateGoMod(spec, config, pkgName, outputDir) {
    const modulePath = config.package || `github.com/yourcompany/${pkgName}`;
    const content = `module ${modulePath}\n\ngo 1.21\n\nrequire (\n\tgithub.com/google/go-querystring v1.1.0\n)\n`;
    await fs.writeFile(path.join(outputDir, 'go.mod'), content, 'utf-8');
}
async function generateGoClient(spec, config, pkgName, outputDir) {
    const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
    const securitySchemes = spec.components?.securitySchemes || {};
    const hasAuth = Object.keys(securitySchemes).length > 0;
    let content = `package ${pkgName}\n\n`;
    content += `import (\n`;
    content += `\t"bytes"\n`;
    content += `\t"context"\n`;
    content += `\t"encoding/json"\n`;
    content += `\t"fmt"\n`;
    content += `\t"io"\n`;
    content += `\t"net/http"\n`;
    content += `\t"net/url"\n`;
    content += `\t"time"\n`;
    content += `)\n\n`;
    content += `// Config holds SDK configuration.\n`;
    content += `type Config struct {\n`;
    content += `\tBaseURL      string\n`;
    content += `\tHTTPClient   *http.Client\n`;
    if (hasAuth) {
        content += `\tAPIKey       string\n`;
        content += `\tBearerToken  string\n`;
    }
    content += `\tTimeout      time.Duration\n`;
    content += `}\n\n`;
    content += `// Client is the API client for ${spec.info.title}.\n`;
    content += `type Client struct {\n`;
    content += `\tconfig     Config\n`;
    content += `\tbaseURL    *url.URL\n`;
    content += `\thttpClient *http.Client\n`;
    if (hasAuth) {
        content += `\tapiKey      string\n`;
        content += `\tbearerToken string\n`;
    }
    content += `}\n\n`;
    content += `// NewClient creates a new API client.\n`;
    content += `func NewClient(config Config) (*Client, error) {\n`;
    content += `\tbaseURL := config.BaseURL\n`;
    content += `\tif baseURL == "" {\n`;
    content += `\t\tbaseURL = "${baseUrl}"\n`;
    content += `\t}\n\n`;
    content += `\tparsedURL, err := url.Parse(baseURL)\n`;
    content += `\tif err != nil {\n`;
    content += `\t\treturn nil, fmt.Errorf("invalid base URL: %w", err)\n`;
    content += `\t}\n\n`;
    content += `\ttimeout := config.Timeout\n`;
    content += `\tif timeout == 0 {\n`;
    content += `\t\ttimeout = 30 * time.Second\n`;
    content += `\t}\n\n`;
    content += `\thttpClient := config.HTTPClient\n`;
    content += `\tif httpClient == nil {\n`;
    content += `\t\thttpClient = &http.Client{Timeout: timeout}\n`;
    content += `\t}\n\n`;
    content += `\treturn &Client{\n`;
    content += `\t\tconfig:     config,\n`;
    content += `\t\tbaseURL:    parsedURL,\n`;
    content += `\t\thttpClient: httpClient,\n`;
    if (hasAuth) {
        content += `\t\tapiKey:      config.APIKey,\n`;
        content += `\t\tbearerToken: config.BearerToken,\n`;
    }
    content += `\t}, nil\n`;
    content += `}\n`;
    if (hasAuth) {
        content += `\n// SetAPIKey updates the API key.\n`;
        content += `func (c *Client) SetAPIKey(key string) {\n`;
        content += `\tc.apiKey = key\n`;
        content += `}\n\n`;
        content += `// SetBearerToken updates the bearer token.\n`;
        content += `func (c *Client) SetBearerToken(token string) {\n`;
        content += `\tc.bearerToken = token\n`;
        content += `}\n`;
    }
    content += `\n// Request makes an HTTP request.\n`;
    content += `func (c *Client) Request(ctx context.Context, method, path string, body interface{}, queryParams url.Values) (*http.Response, error) {\n`;
    content += `\treqURL := c.baseURL.ResolveReference(&url.URL{Path: path, RawQuery: queryParams.Encode()})\n\n`;
    content += `\tvar bodyReader io.Reader\n`;
    content += `\tif body != nil {\n`;
    content += `\t\tjsonBody, err := json.Marshal(body)\n`;
    content += `\t\tif err != nil {\n`;
    content += `\t\t\treturn nil, fmt.Errorf("marshal request body: %w", err)\n`;
    content += `\t\t}\n`;
    content += `\t\tbodyReader = bytes.NewReader(jsonBody)\n`;
    content += `\t}\n\n`;
    content += `\treq, err := http.NewRequestWithContext(ctx, method, reqURL.String(), bodyReader)\n`;
    content += `\tif err != nil {\n`;
    content += `\t\treturn nil, fmt.Errorf("create request: %w", err)\n`;
    content += `\t}\n\n`;
    content += `\treq.Header.Set("Content-Type", "application/json")\n`;
    if (hasAuth) {
        content += `\n\tif c.bearerToken != "" {\n`;
        content += `\t\treq.Header.Set("Authorization", "Bearer "+c.bearerToken)\n`;
        content += `\t} else if c.apiKey != "" {\n`;
        content += `\t\treq.Header.Set("Authorization", "Bearer "+c.apiKey)\n`;
        content += `\t}\n`;
    }
    content += `\n\tresp, err := c.httpClient.Do(req)\n`;
    content += `\tif err != nil {\n`;
    content += `\t\treturn nil, fmt.Errorf("execute request: %w", err)\n`;
    content += `\t}\n\n`;
    content += `\tif resp.StatusCode >= 400 {\n`;
    content += `\t\tbody, _ := io.ReadAll(resp.Body)\n`;
    content += `\t\tresp.Body.Close()\n`;
    content += `\t\treturn nil, &APIError{\n`;
    content += `\t\t\tStatusCode: resp.StatusCode,\n`;
    content += `\t\t\tMessage:    string(body),\n`;
    content += `\t\t}\n`;
    content += `\t}\n\n`;
    content += `\treturn resp, nil\n`;
    content += `}\n\n`;
    content += `// DecodeJSON decodes a JSON response.\n`;
    content += `func (c *Client) DecodeJSON(resp *http.Response, v interface{}) error {\n`;
    content += `\tdefer resp.Body.Close()\n`;
    content += `\treturn json.NewDecoder(resp.Body).Decode(v)\n`;
    content += `}\n`;
    await fs.writeFile(path.join(outputDir, 'client.go'), content, 'utf-8');
}
async function generateGoModels(spec, config, pkgName, outputDir) {
    const modelsDir = path.join(outputDir, 'models');
    let content = `package models\n\n`;
    content += `import (\n`;
    content += `\t"time"\n`;
    content += `)\n\n`;
    const schemas = (0, openapi_1.getAllSchemas)(spec);
    for (const { name, schema } of schemas) {
        if (schema.type === 'string' && schema.enum) {
            content += generateGoEnum(name, schema);
        }
        else {
            content += generateGoStruct(name, schema);
        }
        content += '\n';
    }
    await fs.writeFile(path.join(modelsDir, 'models.go'), content, 'utf-8');
}
function generateGoStruct(name, schema) {
    const structName = toPascalCase(name);
    const description = schema.description || `Model: ${name}`;
    let content = `// ${structName} represents ${description}.\n`;
    content += `type ${structName} struct {\n`;
    const properties = {};
    const required = new Set();
    if (schema.allOf) {
        for (const sub of schema.allOf) {
            if (!('$ref' in sub)) {
                Object.assign(properties, sub.properties || {});
                (sub.required || []).forEach(r => required.add(r));
            }
        }
    }
    if (schema.properties) {
        Object.assign(properties, schema.properties);
    }
    (schema.required || []).forEach(r => required.add(r));
    for (const [propName, propSchema] of Object.entries(properties)) {
        const goTyp = goType(propName, propSchema, required.has(propName));
        const jsonTag = toCamelCase(propName);
        const desc = propSchema.description || '';
        if (desc) {
            content += `\t// ${desc}\n`;
        }
        content += `\t${toPascalCase(propName)} ${goTyp} \`json:"${jsonTag}${required.has(propName) ? '' : ',omitempty'}"\`\n`;
    }
    content += '}\n';
    return content;
}
function generateGoEnum(name, schema) {
    const typeName = toPascalCase(name);
    const description = schema.description || `Enum: ${name}`;
    let content = `// ${typeName} represents ${description}.\n`;
    content += `type ${typeName} string\n\nconst (\n`;
    for (const value of schema.enum || []) {
        const constName = toPascalCase(name) + toPascalCase(String(value));
        content += `\t${constName} ${typeName} = "${value}"\n`;
    }
    content += ')\n';
    return content;
}
function goType(name, schema, required) {
    let type;
    if ('$ref' in schema) {
        const refName = schema.$ref?.split('/').pop() || 'interface{}';
        type = toPascalCase(refName);
    }
    else {
        switch (schema.type) {
            case 'string':
                if (schema.format === 'date-time')
                    type = 'time.Time';
                else
                    type = 'string';
                break;
            case 'integer':
                if (schema.format === 'int64')
                    type = 'int64';
                else
                    type = 'int';
                break;
            case 'number':
                type = 'float64';
                break;
            case 'boolean':
                type = 'bool';
                break;
            case 'array':
                if (schema.items) {
                    const itemType = goType(`${name}_item`, schema.items, true);
                    type = `[]${itemType}`;
                }
                else {
                    type = '[]interface{}';
                }
                break;
            case 'object':
                type = 'map[string]interface{}';
                break;
            default:
                type = 'interface{}';
        }
    }
    if (!required && schema.type !== 'object') {
        return `*${type}`;
    }
    return type;
}
async function generateGoAPI(spec, config, pkgName, outputDir) {
    const apiDir = path.join(outputDir, 'api');
    const operations = (0, openapi_1.getAllOperations)(spec);
    const tagGroups = {};
    for (const op of operations) {
        const tag = op.operation.tags?.[0] || 'general';
        if (!tagGroups[tag])
            tagGroups[tag] = [];
        tagGroups[tag].push(op);
    }
    for (const [tag, ops] of Object.entries(tagGroups)) {
        const fileName = toSnakeCase(tag) + '.go';
        let content = `package ${pkgName}\n\n`;
        content += `import (\n`;
        content += `\t"context"\n`;
        content += `\t"fmt"\n`;
        content += `\t"net/url"\n\n`;
        content += `\t"${config.package || 'github.com/yourcompany/' + pkgName}/models"\n`;
        content += `)\n\n`;
        content += `// ${toPascalCase(tag)}API handles ${tag} operations.\n`;
        content += `type ${toPascalCase(tag)}API struct {\n`;
        content += `\tclient *Client\n`;
        content += `}\n\n`;
        content += `// new${toPascalCase(tag)}API creates a new ${tag} API handler.\n`;
        content += `func new${toPascalCase(tag)}API(client *Client) *${toPascalCase(tag)}API {\n`;
        content += `\treturn &${toPascalCase(tag)}API{client: client}\n`;
        content += `}\n\n`;
        for (const { operation, method, path: pathStr } of ops) {
            content += generateGoMethod(operation, method, pathStr, tag);
        }
        await fs.writeFile(path.join(apiDir, fileName), content, 'utf-8');
    }
}
function generateGoMethod(operation, method, path, tag) {
    const opId = operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const opName = toPascalCase(opId);
    const hasParams = operation.parameters && operation.parameters.length > 0;
    const hasRequestBody = operation.requestBody && !('$ref' in operation.requestBody);
    let params = [];
    let pathVars = [];
    let queryVars = [];
    if (hasParams) {
        for (const param of operation.parameters || []) {
            if ('$ref' in param)
                continue;
            const p = param;
            const goTyp = goType(p.name, p.schema || { type: 'string' }, !!p.required);
            params.push(`${toCamelCase(p.name)} ${goTyp}`);
            if (p.in === 'path') {
                pathVars.push(p.name);
            }
            else if (p.in === 'query') {
                queryVars.push(toCamelCase(p.name));
            }
        }
    }
    if (hasRequestBody) {
        params.push('body interface{}');
    }
    let methodPath = path;
    for (const pv of pathVars) {
        methodPath = methodPath.replace(`{${pv}}`, '%s');
    }
    let content = `// ${opName} calls ${method.toUpperCase()} ${path}\n`;
    content += `// @graft(preserve) id="${toSnakeCase(opId)}-custom"\n`;
    content += `func (api *${toPascalCase(tag)}API) ${opName}(ctx context.Context${params.length > 0 ? ', ' + params.join(', ') : ''}) (*http.Response, error) {\n`;
    if (pathVars.length > 0) {
        content += `\tpath := fmt.Sprintf("${methodPath}"${pathVars.map(v => `, ${toCamelCase(v)}`).join('')})\n`;
    }
    else {
        content += `\tpath := "${methodPath}"\n`;
    }
    if (queryVars.length > 0) {
        content += `\tquery := url.Values{}\n`;
        for (const qv of queryVars) {
            content += `\tif ${qv} != nil {\n\t\tquery.Set("${qv}", fmt.Sprintf("%v", *${qv}))\n\t}\n`;
        }
    }
    content += `\treturn api.client.Request(ctx, "${method.toUpperCase()}", path${hasRequestBody ? ', body' : ', nil'}${queryVars.length > 0 ? ', query' : ', nil'})\n`;
    content += `}\n\n`;
    return content;
}
async function generateGoErrors(pkgName, outputDir) {
    let content = `package ${pkgName}\n\n`;
    content += `import "fmt"\n\n`;
    content += `// SDKError is the base error type.\n`;
    content += `type SDKError struct {\n`;
    content += `\tMessage string\n`;
    content += `}\n\n`;
    content += `func (e *SDKError) Error() string {\n`;
    content += `\treturn fmt.Sprintf("sdk error: %s", e.Message)\n`;
    content += `}\n\n`;
    content += `// APIError represents an API-level error.\n`;
    content += `type APIError struct {\n`;
    content += `\tStatusCode int\n`;
    content += `\tMessage    string\n`;
    content += `}\n\n`;
    content += `func (e *APIError) Error() string {\n`;
    content += `\treturn fmt.Sprintf("API error (status %d): %s", e.StatusCode, e.Message)\n`;
    content += `}\n\n`;
    content += `// ValidationError represents a validation error.\n`;
    content += `type ValidationError struct {\n`;
    content += `\tMessage string\n`;
    content += `\tErrors  map[string][]string\n`;
    content += `}\n\n`;
    content += `func (e *ValidationError) Error() string {\n`;
    content += `\treturn fmt.Sprintf("validation error: %s", e.Message)\n`;
    content += `}\n\n`;
    content += `// AuthError represents an authentication error.\n`;
    content += `type AuthError struct {\n`;
    content += `\tMessage string\n`;
    content += `}\n\n`;
    content += `func (e *AuthError) Error() string {\n`;
    content += `\tif e.Message == "" {\n`;
    content += `\t\treturn "authentication error"\n`;
    content += `\t}\n`;
    content += `\treturn fmt.Sprintf("auth error: %s", e.Message)\n`;
    content += `}\n`;
    await fs.writeFile(path.join(outputDir, 'errors.go'), content, 'utf-8');
}
async function generateGoREADME(spec, config, outputDir) {
    const modulePath = config.package || `github.com/yourcompany/${toGoPackageName(spec.info.title)}`;
    let content = `# ${modulePath}\n\n`;
    content += `${spec.info.description || `Go SDK for ${spec.info.title}`}\n\n`;
    content += `## Installation\n\n`;
    content += `\`\`\`bash\n`;
    content += `go get ${modulePath}\n`;
    content += `\`\`\`\n\n`;
    content += `## Quick Start\n\n`;
    content += `\`\`\`go\n`;
    content += `package main\n\n`;
    content += `import (\n`;
    content += `    "context"\n`;
    content += `    "log"\n`;
    content += `    \n`;
    content += `    sdk "${modulePath}"\n`;
    content += `)\n\n`;
    content += `func main() {\n`;
    content += `    client, err := sdk.NewClient(sdk.Config{\n`;
    content += `        BaseURL: "${spec.servers?.[0]?.url || 'https://api.example.com'}",\n`;
    content += `        APIKey:  "your-api-key",\n`;
    content += `    })\n`;
    content += `    if err != nil {\n`;
    content += `        log.Fatal(err)\n`;
    content += `    }\n\n`;
    content += `    ctx := context.Background()\n`;
    content += `    resp, err := client.API.OperationName(ctx, ...)\n`;
    content += `    if err != nil {\n`;
    content += `        log.Fatal(err)\n`;
    content += `    }\n`;
    content += `    // Handle response\n`;
    content += `}\n`;
    content += `\`\`\`\n\n`;
    content += `## Preserving Custom Code\n\n`;
    content += `Use \`@graft\` annotations to preserve custom code:\n\n`;
    content += `\`\`\`go\n`;
    content += `// @graft(preserve) id="custom-handler"\n`;
    content += `func (api *API) CustomHandler(ctx context.Context, req Request) (*Response, error) {\n`;
    content += `    // Custom implementation survives regeneration\n`;
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
function toSnakeCase(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_{2,}/g, '_');
}
function toGoPackageName(title) {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}
//# sourceMappingURL=golang.js.map