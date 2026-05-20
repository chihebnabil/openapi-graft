/**
 * Java SDK Generator
 * Generates idiomatic Java SDKs from OpenAPI specs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { OpenAPISpec, SchemaObject, OperationObject, ParameterObject, SDKConfig } from '../types';
import { getAllOperations, getAllSchemas, getSchemaType } from '../parser/openapi';

/**
 * Generate Java SDK
 */
export async function generateJavaSDK(
  spec: OpenAPISpec,
  config: SDKConfig
): Promise<void> {
  const outputDir = config.output;
  await fs.ensureDir(outputDir);

  // Create Maven-style directory structure
  const pkgPath = (config.package || `com.${toJavaPackageName(spec.info.title)}`).replace(/\./g, '/');
  const srcDir = path.join(outputDir, 'src/main/java', pkgPath);
  const resourceDir = path.join(outputDir, 'src/main/resources');
  const testDir = path.join(outputDir, 'src/test/java', pkgPath);

  await fs.ensureDir(path.join(srcDir, 'models'));
  await fs.ensureDir(path.join(srcDir, 'api'));
  await fs.ensureDir(path.join(srcDir, 'exceptions'));
  await fs.ensureDir(resourceDir);
  await fs.ensureDir(testDir);

  // Generate pom.xml
  await generatePomXml(spec, config, outputDir);

  // Generate client
  await generateJavaClient(spec, config, srcDir);

  // Generate models
  await generateJavaModels(spec, config, srcDir);

  // Generate API clients
  await generateJavaAPI(spec, config, srcDir);

  // Generate exceptions
  await generateJavaExceptions(srcDir);

  // Generate README
  await generateJavaREADME(spec, config, outputDir);
}

async function generatePomXml(spec: OpenAPISpec, config: SDKConfig, outputDir: string): Promise<void> {
  const pkgName = config.package || `com.${toJavaPackageName(spec.info.title)}`;
  
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${pkgName}</groupId>
    <artifactId>${toArtifactId(spec.info.title)}</artifactId>
    <version>${spec.info.version || '0.1.0'}</version>
    <packaging>jar</packaging>

    <name>${spec.info.title}</name>
    <description>${spec.info.description || `Java SDK for ${spec.info.title}`}</description>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <jackson.version>2.17.0</jackson.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>\${jackson.version}</version>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>
            <version>\${jackson.version}</version>
        </dependency>
    </dependencies>
</project>
`;

  await fs.writeFile(path.join(outputDir, 'pom.xml'), content, 'utf-8');
}

async function generateJavaClient(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const pkgName = config.package || `com.${toJavaPackageName(spec.info.title)}`;
  const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
  const securitySchemes = spec.components?.securitySchemes || {};
  const hasAuth = Object.keys(securitySchemes).length > 0;

  let content = `package ${pkgName};

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import ${pkgName}.exceptions.*;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * ${spec.info.title} - Java SDK Client
 * @version ${spec.info.version}
 */
public class Client {
    private static final String DEFAULT_BASE_URL = "${baseUrl}";
    private static final int DEFAULT_TIMEOUT = 30;

    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    ${hasAuth ? `private String apiKey;\n    private String bearerToken;` : ''}

    public Client() {
        this(Builder.builder());
    }

    private Client(Builder builder) {
        this.baseUrl = builder.baseUrl != null ? builder.baseUrl : DEFAULT_BASE_URL;
        ${hasAuth ? `this.apiKey = builder.apiKey;\n        this.bearerToken = builder.bearerToken;` : ''}
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(builder.timeout != 0 ? builder.timeout : DEFAULT_TIMEOUT))
            .build();
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    ${hasAuth ? `
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public void setBearerToken(String bearerToken) {
        this.bearerToken = bearerToken;
    }
    ` : ''}

    public <T> T request(String method, String path, Object body, Map<String, String> queryParams, Class<T> responseType) throws SDKException {
        try {
            String url = baseUrl + path;
            if (queryParams != null && !queryParams.isEmpty()) {
                StringBuilder query = new StringBuilder("?");
                for (Map.Entry<String, String> entry : queryParams.entrySet()) {
                    if (entry.getValue() != null) {
                        query.append(entry.getKey()).append("=").append(entry.getValue()).append("&");
                    }
                }
                url += query.toString();
            }

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json");

            ${hasAuth ? `
            if (bearerToken != null && !bearerToken.isEmpty()) {
                requestBuilder.header("Authorization", "Bearer " + bearerToken);
            } else if (apiKey != null && !apiKey.isEmpty()) {
                requestBuilder.header("Authorization", "Bearer " + apiKey);
            }
            ` : ''}

            HttpRequest.BodyPublisher bodyPublisher = body != null
                ? HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body))
                : HttpRequest.BodyPublishers.noBody();

            HttpRequest request = requestBuilder
                .method(method, bodyPublisher)
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                throw new APIException(
                    "HTTP " + response.statusCode() + ": " + response.body(),
                    response.statusCode(),
                    response.body()
                );
            }

            if (response.statusCode() == 204 || responseType == Void.class) {
                return null;
            }

            return objectMapper.readValue(response.body(), responseType);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SDKException("Request interrupted", e);
        } catch (IOException e) {
            throw new SDKException("Request failed", e);
        }
    }

    public <T> CompletableFuture<T> requestAsync(String method, String path, Object body, Map<String, String> queryParams, Class<T> responseType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return request(method, path, body, queryParams, responseType);
            } catch (SDKException e) {
                throw new RuntimeException(e);
            }
        });
    }

    public ObjectMapper getObjectMapper() {
        return objectMapper;
    }

    public static class Builder {
        private String baseUrl;
        ${hasAuth ? `private String apiKey;\n        private String bearerToken;` : ''}
        private int timeout;

        private Builder() {}

        public static Builder builder() {
            return new Builder();
        }

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        ${hasAuth ? `
        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder bearerToken(String bearerToken) {
            this.bearerToken = bearerToken;
            return this;
        }
        ` : ''}

        public Builder timeout(int timeout) {
            this.timeout = timeout;
            return this;
        }

        public Client build() {
            return new Client(this);
        }
    }
}
`;

  await fs.writeFile(path.join(srcDir, 'Client.java'), content, 'utf-8');
}

async function generateJavaModels(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const modelsDir = path.join(srcDir, 'models');
  const pkgName = config.package || `com.${toJavaPackageName(spec.info.title)}`;
  const schemas = getAllSchemas(spec);

  for (const { name, schema } of schemas) {
    const content = generateJavaModel(name, schema, pkgName);
    await fs.writeFile(path.join(modelsDir, `${toPascalCase(name)}.java`), content, 'utf-8');
  }
}

function generateJavaModel(name: string, schema: SchemaObject, pkgName: string): string {
  const className = toPascalCase(name);
  const description = schema.description || `Model: ${name}`;

  let content = `package ${pkgName}.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

`;

  if (schema.type === 'string' && schema.enum) {
    // Generate enum
    content += `/**
 * ${description}
 */
public enum ${className} {
${schema.enum.map(e => `    @JsonProperty("${e}")\n    ${toJavaEnumConstant(String(e))}`).join(',\n')}
}
`;
  } else {
    // Generate class
    content += `/**
 * ${description}
 */
public class ${className} {
`;

    const properties: Record<string, SchemaObject> = {};
    const required: Set<string> = new Set();

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

    // Fields
    for (const [propName, propSchema] of Object.entries(properties)) {
      const jType = getJavaType(propSchema as SchemaObject);
      const desc = (propSchema as SchemaObject).description || '';
      
      if (desc) {
        content += `    /** ${desc} */\n`;
      }
      content += `    @JsonProperty("${propName}")\n`;
      content += `    private ${jType} ${toCamelCase(propName)};\n`;
    }

    // Default constructor
    content += `\n    public ${className}() {}\n`;

    // Getters and setters
    for (const [propName, propSchema] of Object.entries(properties)) {
      const jType = getJavaType(propSchema as SchemaObject);
      const fieldName = toCamelCase(propName);
      const methodName = toPascalCase(propName);

      content += `\n    public ${jType} get${methodName}() {\n`;
      content += `        return ${fieldName};\n`;
      content += `    }\n`;
      content += `\n    public void set${methodName}(${jType} ${fieldName}) {\n`;
      content += `        this.${fieldName} = ${fieldName};\n`;
      content += `    }\n`;
    }

    content += `}\n`;
  }

  return content;
}

function getJavaType(schema: SchemaObject): string {
  if ('$ref' in schema) {
    const refName = schema.$ref?.split('/').pop() || 'Object';
    return toPascalCase(refName);
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return 'OffsetDateTime';
      if (schema.format === 'date') return 'LocalDate';
      return 'String';
    case 'integer':
      if (schema.format === 'int64') return 'Long';
      return 'Integer';
    case 'number':
      return 'Double';
    case 'boolean':
      return 'Boolean';
    case 'array':
      if (schema.items) {
        const itemType = getJavaType(schema.items as SchemaObject);
        return `List<${itemType}>`;
      }
      return 'List<Object>';
    case 'object':
      return 'Map<String, Object>';
    default:
      return 'Object';
  }
}

async function generateJavaAPI(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const apiDir = path.join(srcDir, 'api');
  const pkgName = config.package || `com.${toJavaPackageName(spec.info.title)}`;
  const operations = getAllOperations(spec);
  
  // Group by tag
  const tagGroups: Record<string, typeof operations> = {};
  
  for (const op of operations) {
    const tag = op.operation.tags?.[0] || 'general';
    if (!tagGroups[tag]) tagGroups[tag] = [];
    tagGroups[tag].push(op);
  }

  for (const [tag, ops] of Object.entries(tagGroups)) {
    const className = toPascalCase(tag) + 'Api';
    
    let content = `package ${pkgName}.api;

import ${pkgName}.Client;
import ${pkgName}.exceptions.SDKException;
import ${pkgName}.models.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * ${tag} API operations
 */
public class ${className} {
    private final Client client;

    public ${className}(Client client) {
        this.client = client;
    }

`;

    for (const { operation, method, path: pathStr } of ops) {
      content += generateJavaMethod(operation, method, pathStr);
    }

    content += `}\n`;

    await fs.writeFile(path.join(apiDir, `${className}.java`), content, 'utf-8');
  }
}

function generateJavaMethod(operation: OperationObject, method: string, path: string): string {
  const opId = operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const opName = toCamelCase(opId);
  
  const hasParams = operation.parameters && operation.parameters.length > 0;
  const hasRequestBody = operation.requestBody && !('$ref' in operation.requestBody);

  let params: string[] = [];
  let pathFormatVars: string[] = [];

  if (hasParams) {
    for (const param of operation.parameters || []) {
      if ('$ref' in param) continue;
      const p = param as ParameterObject;
      const jType = getJavaType(p.schema || { type: 'string' });
      params.push(`${jType} ${toCamelCase(p.name)}`);
      
      if (p.in === 'path') {
        pathFormatVars.push(toCamelCase(p.name));
      }
    }
  }

  if (hasRequestBody) {
    params.push('Object body');
  }

  let methodPath = path;
  for (const pv of pathFormatVars) {
    methodPath = methodPath.replace(`{${pv}}`, '%s');
  }

  let content = `    // @graft(preserve) id="${toSnakeCase(opId)}-custom"\n`;
  content += `    public Object ${opName}(${params.join(', ')}) throws SDKException {\n`;
  content += `        String path = String.format("${methodPath}"${pathFormatVars.map(v => `, ${toCamelCase(v)}`).join('')});\n`;
  content += `        return client.request("${method.toUpperCase()}", path${hasRequestBody ? ', body' : ', null'}, null, Object.class);\n`;
  content += `    }\n\n`;

  return content;
}

async function generateJavaExceptions(srcDir: string): Promise<void> {
  const pkgName = path.basename(path.dirname(srcDir));
  const exceptionsDir = path.join(srcDir, 'exceptions');

  const sdkException = `package ${pkgName}.exceptions;

public class SDKException extends Exception {
    public SDKException(String message) {
        super(message);
    }

    public SDKException(String message, Throwable cause) {
        super(message, cause);
    }
}
`;

  const apiException = `package ${pkgName}.exceptions;

public class APIException extends SDKException {
    private final int statusCode;
    private final String responseBody;

    public APIException(String message, int statusCode, String responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }
}
`;

  const validationException = `package ${pkgName}.exceptions;

import java.util.Map;
import java.util.List;

public class ValidationException extends SDKException {
    private final Map<String, List<String>> errors;

    public ValidationException(String message, Map<String, List<String>> errors) {
        super(message);
        this.errors = errors;
    }

    public Map<String, List<String>> getErrors() {
        return errors;
    }
}
`;

  const authException = `package ${pkgName}.exceptions;

public class AuthException extends SDKException {
    public AuthException(String message) {
        super(message);
    }
}
`;

  await fs.writeFile(path.join(exceptionsDir, 'SDKException.java'), sdkException, 'utf-8');
  await fs.writeFile(path.join(exceptionsDir, 'APIException.java'), apiException, 'utf-8');
  await fs.writeFile(path.join(exceptionsDir, 'ValidationException.java'), validationException, 'utf-8');
  await fs.writeFile(path.join(exceptionsDir, 'AuthException.java'), authException, 'utf-8');
}

async function generateJavaREADME(spec: OpenAPISpec, config: SDKConfig, outputDir: string): Promise<void> {
  const pkgName = config.package || `com.${toJavaPackageName(spec.info.title)}`;
  
  const content = `# ${spec.info.title} Java SDK

${spec.info.description || `Java SDK for ${spec.info.title}`}

## Installation

### Maven

Add to your \`pom.xml\`:

\`\`\`xml
<dependency>
    <groupId>${pkgName}</groupId>
    <artifactId>${toArtifactId(spec.info.title)}</artifactId>
    <version>${spec.info.version || '0.1.0'}</version>
</dependency>
\`\`\`

## Quick Start

\`\`\`java
import ${pkgName}.Client;
import ${pkgName}.models.*;
import ${pkgName}.exceptions.SDKException;

public class Main {
    public static void main(String[] args) {
        Client client = Client.builder()
            .baseUrl("${spec.servers?.[0]?.url || 'https://api.example.com'}")
            .apiKey("your-api-key")
            .build();

        try {
            Object result = client.request("GET", "/endpoint", null, null, Object.class);
            System.out.println(result);
        } catch (SDKException e) {
            e.printStackTrace();
        }
    }
}
\`\`\`

## Preserving Custom Code

Use \`@graft\` annotations to preserve custom code:

\`\`\`java
// @graft(preserve) id="custom-handler"
public Object customHandler(String param) throws SDKException {
    // Custom implementation survives regeneration
}
\`\`\`

## License

MIT
`;

  await fs.writeFile(path.join(outputDir, 'README.md'), content, 'utf-8');
}

// Utility functions
function toPascalCase(str: string): string {
  return str.replace(/(?:^|[-_])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toJavaPackageName(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '.');
}

function toJavaEnumConstant(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
}

function toArtifactId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-sdk';
}
