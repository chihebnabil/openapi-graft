/**
 * Rust SDK Generator
 * Generates idiomatic Rust SDKs from OpenAPI specs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { OpenAPISpec, SchemaObject, OperationObject, ParameterObject, SDKConfig } from '../types';
import { getAllOperations, getAllSchemas, getSchemaType } from '../parser/openapi';

/**
 * Generate Rust SDK
 */
export async function generateRustSDK(
  spec: OpenAPISpec,
  config: SDKConfig
): Promise<void> {
  const outputDir = config.output;
  await fs.ensureDir(outputDir);

  const srcDir = path.join(outputDir, 'src');
  await fs.ensureDir(srcDir);
  await fs.ensureDir(path.join(srcDir, 'models'));
  await fs.ensureDir(path.join(srcDir, 'api'));

  await generateCargoToml(spec, config, outputDir);
  await generateLibRs(spec, config, srcDir);
  await generateRustClient(spec, config, srcDir);
  await generateRustModels(spec, config, srcDir);
  await generateRustAPI(spec, config, srcDir);
  await generateRustErrors(srcDir);
  await generateRustREADME(spec, config, outputDir);
}

async function generateCargoToml(spec: OpenAPISpec, config: SDKConfig, outputDir: string): Promise<void> {
  const crateName = config.package?.replace('@', '')?.replace('/', '-') || toSnakeCase(spec.info.title) + '-sdk';
  
  let content = `[package]\n`;
  content += `name = "${crateName}"\n`;
  content += `version = "${spec.info.version || '0.1.0'}"\n`;
  content += `edition = "2021"\n`;
  content += `description = "${spec.info.description || `Rust SDK for ${spec.info.title}`}"\n`;
  content += `license = "MIT"\n`;
  content += `rust-version = "1.75"\n\n`;
  content += `[dependencies]\n`;
  content += `reqwest = { version = "0.12", features = ["json"] }\n`;
  content += `serde = { version = "1.0", features = ["derive"] }\n`;
  content += `serde_json = "1.0"\n`;
  content += `tokio = { version = "1.37", features = ["rt-multi-thread", "macros"] }\n`;
  content += `thiserror = "1.0"\n`;
  content += `chrono = { version = "0.4", features = ["serde"] }\n`;
  content += `url = "2.5"\n\n`;
  content += `[dev-dependencies]\n`;
  content += `tokio-test = "0.4"\n`;
  content += `mockito = "1.4"\n`;

  await fs.writeFile(path.join(outputDir, 'Cargo.toml'), content, 'utf-8');
}

async function generateLibRs(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  let content = `//! ${spec.info.title}\n`;
  content += `//!\n`;
  content += `//! ${spec.info.description || `Rust SDK for ${spec.info.title}`}\n\n`;
  content += `pub mod client;\n`;
  content += `pub mod models;\n`;
  content += `pub mod api;\n`;
  content += `pub mod errors;\n\n`;
  content += `pub use client::{Client, Config};\n`;
  content += `pub use errors::{GraftError, GraftResult};\n`;

  await fs.writeFile(path.join(srcDir, 'lib.rs'), content, 'utf-8');
}

async function generateRustClient(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
  const securitySchemes = spec.components?.securitySchemes || {};
  const hasAuth = Object.keys(securitySchemes).length > 0;

  let content = `use std::time::Duration;\n\n`;
  content += `use reqwest::{Client as ReqwestClient, Response};\n`;
  content += `use serde::de::DeserializeOwned;\n`;
  content += `use serde_json::Value;\n`;
  content += `use url::Url;\n\n`;
  content += `use crate::errors::{GraftError, GraftResult};\n\n`;
  content += `/// SDK Configuration\n`;
  content += `#[derive(Debug, Clone)]\n`;
  content += `pub struct Config {\n`;
  content += `    pub base_url: String,\n`;
  content += `    pub timeout: Duration,\n`;
  if (hasAuth) {
    content += `    pub api_key: Option<String>,\n`;
    content += `    pub bearer_token: Option<String>,\n`;
  }
  content += `    pub headers: Vec<(String, String)>,\n`;
  content += `}\n\n`;
  content += `impl Default for Config {\n`;
  content += `    fn default() -> Self {\n`;
  content += `        Self {\n`;
  content += `            base_url: "${baseUrl}".to_string(),\n`;
  content += `            timeout: Duration::from_secs(30),\n`;
  if (hasAuth) {
    content += `            api_key: None,\n`;
    content += `            bearer_token: None,\n`;
  }
  content += `            headers: Vec::new(),\n`;
  content += `        }\n`;
  content += `    }\n`;
  content += `}\n\n`;

  content += `/// API Client\n`;
  content += `#[derive(Debug)]\n`;
  content += `pub struct Client {\n`;
  content += `    config: Config,\n`;
  content += `    http: ReqwestClient,\n`;
  if (hasAuth) {
    content += `    api_key: Option<String>,\n`;
    content += `    bearer_token: Option<String>,\n`;
  }
  content += `}\n\n`;

  content += `impl Client {\n`;
  content += `    /// Create a new client with the given configuration.\n`;
  content += `    pub fn new(config: Config) -> GraftResult<Self> {\n`;
  content += `        let mut headers = reqwest::header::HeaderMap::new();\n`;
  content += `        headers.insert(\n`;
  content += `            reqwest::header::CONTENT_TYPE,\n`;
  content += `            reqwest::header::HeaderValue::from_static("application/json"),\n`;
  content += `        );\n\n`;

  if (hasAuth) {
    content += `        if let Some(ref token) = config.bearer_token {\n`;
    content += `            headers.insert(\n`;
    content += `                reqwest::header::AUTHORIZATION,\n`;
    content += `                reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token))\n`;
    content += `                    .map_err(|e| GraftError::Config(format!("Invalid token: {}", e)))?,\n`;
    content += `            );\n`;
    content += `        } else if let Some(ref key) = config.api_key {\n`;
    content += `            headers.insert(\n`;
    content += `                reqwest::header::AUTHORIZATION,\n`;
    content += `                reqwest::header::HeaderValue::from_str(&format!("Bearer {}", key))\n`;
    content += `                    .map_err(|e| GraftError::Config(format!("Invalid API key: {}", e)))?,\n`;
    content += `            );\n`;
    content += `        }\n\n`;
  }

  content += `        let http = ReqwestClient::builder()\n`;
  content += `            .timeout(config.timeout)\n`;
  content += `            .default_headers(headers)\n`;
  content += `            .build()\n`;
  content += `            .map_err(|e| GraftError::Config(format!("Failed to build HTTP client: {}", e)))?;\n\n`;
  content += `        Ok(Self {\n`;
  content += `            config,\n`;
  content += `            http,\n`;
  if (hasAuth) {
    content += `            api_key: config.api_key.clone(),\n`;
    content += `            bearer_token: config.bearer_token.clone(),\n`;
  }
  content += `        })\n`;
  content += `    }\n`;

  if (hasAuth) {
    content += `\n    /// Update the API key.\n`;
    content += `    pub fn set_api_key(&mut self, key: String) {\n`;
    content += `        self.api_key = Some(key.clone());\n`;
    content += `        self.bearer_token = None;\n`;
    content += `    }\n\n`;
    content += `    /// Update the bearer token.\n`;
    content += `    pub fn set_bearer_token(&mut self, token: String) {\n`;
    content += `        self.bearer_token = Some(token.clone());\n`;
    content += `        self.api_key = None;\n`;
    content += `    }\n`;
  }

  content += `\n    /// Make an authenticated request to the API.\n`;
  content += `    pub async fn request<T>(\n`;
  content += `        &self,\n`;
  content += `        method: reqwest::Method,\n`;
  content += `        path: &str,\n`;
  content += `        body: Option<Value>,\n`;
  content += `        query_params: Option<Vec<(&str, String)>>,\n`;
  content += `    ) -> GraftResult<T>\n`;
  content += `    where\n`;
  content += `        T: DeserializeOwned,\n`;
  content += `    {\n`;
  content += `        let base = Url::parse(&self.config.base_url)\n`;
  content += `            .map_err(|e| GraftError::Config(format!("Invalid base URL: {}", e)))?;\n`;
  content += `        let url = base.join(path)\n`;
  content += `            .map_err(|e| GraftError::Config(format!("Invalid path: {}", e)))?;\n\n`;
  content += `        let mut request = self.http.request(method.clone(), url);\n\n`;
  content += `        if let Some(params) = query_params {\n`;
  content += `            request = request.query(&params);\n`;
  content += `        }\n\n`;
  content += `        if let Some(body) = body {\n`;
  content += `            request = request.json(&body);\n`;
  content += `        }\n\n`;
  content += `        let response = request\n`;
  content += `            .send()\n`;
  content += `            .await\n`;
  content += `            .map_err(|e| GraftError::Request(format!("Request failed: {}", e)))?;\n\n`;
  content += `        let status = response.status();\n`;
  content += `        if status.is_success() {\n`;
  content += `            if status == reqwest::StatusCode::NO_CONTENT {\n`;
  content += `                return serde_json::from_value(Value::Null)\n`;
  content += `                    .map_err(|e| GraftError::Parse(format!("Failed to parse empty response: {}", e)));\n`;
  content += `            }\n`;
  content += `            response\n`;
  content += `                .json::<T>()\n`;
  content += `                .await\n`;
  content += `                .map_err(|e| GraftError::Parse(format!("Failed to parse response: {}", e)))\n`;
  content += `        } else {\n`;
  content += `            let body = response\n`;
  content += `                .text()\n`;
  content += `                .await\n`;
  content += `                .unwrap_or_default();\n`;
  content += `            Err(GraftError::Api {\n`;
  content += `                status: status.as_u16(),\n`;
  content += `                message: body,\n`;
  content += `            })\n`;
  content += `        }\n`;
  content += `    }\n\n`;

  // HTTP method helpers
  content += `    /// GET request\n`;
  content += `    pub async fn get<T>(&self, path: &str, query: Option<Vec<(&str, String)>>) -> GraftResult<T>\n`;
  content += `    where\n`;
  content += `        T: DeserializeOwned,\n`;
  content += `    {\n`;
  content += `        self.request(reqwest::Method::GET, path, None, query).await\n`;
  content += `    }\n\n`;

  content += `    /// POST request\n`;
  content += `    pub async fn post<T>(&self, path: &str, body: Value) -> GraftResult<T>\n`;
  content += `    where\n`;
  content += `        T: DeserializeOwned,\n`;
  content += `    {\n`;
  content += `        self.request(reqwest::Method::POST, path, Some(body), None).await\n`;
  content += `    }\n\n`;

  content += `    /// PUT request\n`;
  content += `    pub async fn put<T>(&self, path: &str, body: Value) -> GraftResult<T>\n`;
  content += `    where\n`;
  content += `        T: DeserializeOwned,\n`;
  content += `    {\n`;
  content += `        self.request(reqwest::Method::PUT, path, Some(body), None).await\n`;
  content += `    }\n\n`;

  content += `    /// PATCH request\n`;
  content += `    pub async fn patch<T>(&self, path: &str, body: Value) -> GraftResult<T>\n`;
  content += `    where\n`;
  content += `        T: DeserializeOwned,\n`;
  content += `    {\n`;
  content += `        self.request(reqwest::Method::PATCH, path, Some(body), None).await\n`;
  content += `    }\n\n`;

  content += `    /// DELETE request\n`;
  content += `    pub async fn delete<T>(&self, path: &str, query: Option<Vec<(&str, String)>>) -> GraftResult<T>\n`;
  content += `    where\n`;
  content += `        T: DeserializeOwned,\n`;
  content += `    {\n`;
  content += `        self.request(reqwest::Method::DELETE, path, None, query).await\n`;
  content += `    }\n`;
  content += `}\n`;

  await fs.writeFile(path.join(srcDir, 'client.rs'), content, 'utf-8');
}

async function generateRustModels(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const modelsDir = path.join(srcDir, 'models');
  
  let content = `use serde::{Deserialize, Serialize};\n`;
  content += `use chrono::{DateTime, NaiveDate, Utc};\n\n`;

  const schemas = getAllSchemas(spec);

  for (const { name, schema } of schemas) {
    if (schema.type === 'string' && schema.enum) {
      content += generateRustEnum(name, schema);
    } else {
      content += generateRustStruct(name, schema);
    }
    content += '\n';
  }

  await fs.writeFile(path.join(modelsDir, 'mod.rs'), content, 'utf-8');
}

function generateRustStruct(name: string, schema: SchemaObject): string {
  const structName = toPascalCase(name);
  const description = schema.description || `Model: ${name}`;

  let content = `/// ${description}\n`;
  content += `#[derive(Debug, Clone, Serialize, Deserialize)]\n`;
  content += `pub struct ${structName} {\n`;

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

  for (const [propName, propSchema] of Object.entries(properties)) {
    const rustTyp = rustType(propName, propSchema as SchemaObject, required.has(propName));
    const desc = (propSchema as SchemaObject).description || '';
    const serdeName = propName;
    
    if (desc) {
      content += `    /// ${desc}\n`;
    }
    content += `    #[serde(rename = "${serdeName}")]\n`;
    content += `    pub ${toSnakeCase(propName)}: ${rustTyp},\n`;
  }

  content += `}\n`;
  return content;
}

function generateRustEnum(name: string, schema: SchemaObject): string {
  const enumName = toPascalCase(name);
  const description = schema.description || `Enum: ${name}`;

  let content = `/// ${description}\n`;
  content += `#[derive(Debug, Clone, Serialize, Deserialize)]\n`;
  content += `pub enum ${enumName} {\n`;

  for (const value of schema.enum || []) {
    const variant = toPascalCase(String(value));
    content += `    #[serde(rename = "${value}")]\n`;
    content += `    ${variant},\n`;
  }

  content += `}\n`;
  return content;
}

function rustType(name: string, schema: SchemaObject, required: boolean): string {
  let typeStr: string;

  if ('$ref' in schema) {
    const refName = schema.$ref?.split('/').pop() || 'serde_json::Value';
    typeStr = toPascalCase(refName);
  } else {
    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') typeStr = 'DateTime<Utc>';
        else if (schema.format === 'date') typeStr = 'NaiveDate';
        else typeStr = 'String';
        break;
      case 'integer':
        if (schema.format === 'int64') typeStr = 'i64';
        else typeStr = 'i32';
        break;
      case 'number':
        typeStr = 'f64';
        break;
      case 'boolean':
        typeStr = 'bool';
        break;
      case 'array':
        if (schema.items) {
          const itemType = rustType(`${name}_item`, schema.items as SchemaObject, true);
          typeStr = `Vec<${itemType}>`;
        } else {
          typeStr = 'Vec<serde_json::Value>';
        }
        break;
      case 'object':
        typeStr = 'serde_json::Value';
        break;
      default:
        typeStr = 'serde_json::Value';
    }
  }

  if (!required) {
    return `Option<${typeStr}>`;
  }

  return typeStr;
}

async function generateRustAPI(spec: OpenAPISpec, config: SDKConfig, srcDir: string): Promise<void> {
  const apiDir = path.join(srcDir, 'api');
  const operations = getAllOperations(spec);
  
  const tagGroups: Record<string, typeof operations> = {};
  
  for (const op of operations) {
    const tag = op.operation.tags?.[0] || 'general';
    if (!tagGroups[tag]) tagGroups[tag] = [];
    tagGroups[tag].push(op);
  }

  for (const [tag, ops] of Object.entries(tagGroups)) {
    const structName = toPascalCase(tag);
    const fileName = toSnakeCase(tag);
    
    let content = `use serde_json::Value;\n\n`;
    content += `use crate::client::Client;\n`;
    content += `use crate::errors::GraftResult;\n`;
    content += `use crate::models::*;\n\n`;
    content += `/// ${tag} API operations\n`;
    content += `pub struct ${structName}Api<'a> {\n`;
    content += `    client: &'a Client,\n`;
    content += `}\n\n`;
    content += `impl<'a> ${structName}Api<'a> {\n`;
    content += `    /// Create a new API handler.\n`;
    content += `    pub fn new(client: &'a Client) -> Self {\n`;
    content += `        Self { client }\n`;
    content += `    }\n\n`;

    for (const { operation, method, path: pathStr } of ops) {
      content += generateRustMethod(operation, method, pathStr);
    }

    content += `}\n`;

    await fs.writeFile(path.join(apiDir, `${fileName}.rs`), content, 'utf-8');
  }

  // Generate mod.rs
  let modContent = '';
  for (const tag of Object.keys(tagGroups)) {
    modContent += `pub mod ${toSnakeCase(tag)};\n`;
  }
  await fs.writeFile(path.join(apiDir, 'mod.rs'), modContent, 'utf-8');
}

function generateRustMethod(operation: OperationObject, method: string, path: string): string {
  const opId = operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const opName = toSnakeCase(opId);
  
  const hasParams = operation.parameters && operation.parameters.length > 0;
  const hasRequestBody = operation.requestBody && !('$ref' in operation.requestBody);

  const params: string[] = [];
  const pathVars: string[] = [];
  const queryVars: string[] = [];

  if (hasParams) {
    for (const param of operation.parameters || []) {
      if ('$ref' in param) continue;
      const p = param as ParameterObject;
      const rustTyp = rustType(p.name, p.schema || { type: 'string' }, !!p.required);
      params.push(`${toSnakeCase(p.name)}: ${rustTyp}`);
      
      if (p.in === 'path') {
        pathVars.push(p.name);
      } else if (p.in === 'query') {
        queryVars.push(toSnakeCase(p.name));
      }
    }
  }

  if (hasRequestBody) {
    params.push('body: Value');
  }

  let methodPath = path;
  for (const pv of pathVars) {
    methodPath = methodPath.replace(`{${pv}}`, '{}');
  }

  let content = `    /// @graft(preserve) id="${opName}-custom"\n`;
  content += `    pub async fn ${opName}(&self${params.length > 0 ? ', ' + params.join(', ') : ''}) -> GraftResult<Value> {\n`;
  
  if (pathVars.length > 0) {
    content += `        let path = format!("${methodPath}"${pathVars.map(v => `, ${toSnakeCase(v)}`).join('')});\n`;
  } else {
    content += `        let path = "${methodPath}";\n`;
  }

  if (queryVars.length > 0) {
    content += `        let query: Vec<(&str, String)> = vec![\n`;
    for (const qv of queryVars) {
      content += `            ("${qv}", ${qv}.to_string()),\n`;
    }
    content += `        ];\n`;
  }

  const httpMethod = method.toUpperCase();
  if (hasRequestBody) {
    content += `        self.client.request(reqwest::Method::${httpMethod}, &path, Some(body), ${queryVars.length > 0 ? 'Some(query)' : 'None'}).await\n`;
  } else {
    content += `        self.client.request(reqwest::Method::${httpMethod}, &path, None, ${queryVars.length > 0 ? 'Some(query)' : 'None'}).await\n`;
  }

  content += `    }\n\n`;

  return content;
}

async function generateRustErrors(srcDir: string): Promise<void> {
  let content = `use thiserror::Error;\n\n`;
  content += `/// Result type for SDK operations.\n`;
  content += `pub type GraftResult<T> = Result<T, GraftError>;\n\n`;
  content += `/// SDK error types.\n`;
  content += `#[derive(Debug, Error)]\n`;
  content += `pub enum GraftError {\n`;
  content += `    /// Configuration error.\n`;
  content += `    #[error("Configuration error: {0}")]\n`;
  content += `    Config(String),\n\n`;
  content += `    /// Request error.\n`;
  content += `    #[error("Request error: {0}")]\n`;
  content += `    Request(String),\n\n`;
  content += `    /// Parse error.\n`;
  content += `    #[error("Parse error: {0}")]\n`;
  content += `    Parse(String),\n\n`;
  content += `    /// API error with status code.\n`;
  content += `    #[error("API error (status {status}): {message}")]\n`;
  content += `    Api { status: u16, message: String },\n\n`;
  content += `    /// Validation error.\n`;
  content += `    #[error("Validation error: {0}")]\n`;
  content += `    Validation(String),\n\n`;
  content += `    /// Authentication error.\n`;
  content += `    #[error("Authentication error: {0}")]\n`;
  content += `    Auth(String),\n`;
  content += `}\n`;

  await fs.writeFile(path.join(srcDir, 'errors.rs'), content, 'utf-8');
}

async function generateRustREADME(spec: OpenAPISpec, config: SDKConfig, outputDir: string): Promise<void> {
  const crateName = config.package?.replace('@', '')?.replace('/', '-') || toSnakeCase(spec.info.title) + '-sdk';
  
  let content = `# ${crateName}\n\n`;
  content += `${spec.info.description || `Rust SDK for ${spec.info.title}`}\n\n`;
  content += `## Installation\n\n`;
  content += `Add to your \`Cargo.toml\`:\n\n`;
  content += `\`\`\`toml\n`;
  content += `[dependencies]\n`;
  content += `${crateName} = "${spec.info.version || '0.1.0'}"\n`;
  content += `\`\`\`\n\n`;
  content += `## Quick Start\n\n`;
  content += `\`\`\`rust\n`;
  content += `use ${crateName.replace(/-/g, '_')}::{Client, Config};\n\n`;
  content += `#[tokio::main]\n`;
  content += `async fn main() -> Result<(), Box<dyn std::error::Error>> {\n`;
  content += `    let config = Config {\n`;
  content += `        base_url: "${spec.servers?.[0]?.url || 'https://api.example.com'}".to_string(),\n`;
  content += `        api_key: Some("your-api-key".to_string()),\n`;
  content += `        ..Default::default()\n`;
  content += `    };\n\n`;
  content += `    let client = Client::new(config)?;\n`;
  content += `    let result: serde_json::Value = client\n`;
  content += `        .get("/endpoint", None)\n`;
  content += `        .await?;\n`;
  content += `    \n`;
  content += `    println!("{:?}", result);\n`;
  content += `    Ok(())\n`;
  content += `}\n`;
  content += `\`\`\`\n\n`;
  content += `## Preserving Custom Code\n\n`;
  content += `Use \`@graft\` annotations to preserve custom code:\n\n`;
  content += `\`\`\`rust\n`;
  content += `/// @graft(preserve) id="custom-handler"\n`;
  content += `pub async fn custom_handler(&self, param: String) -> GraftResult<Value> {\n`;
  content += `    // Custom implementation survives regeneration\n`;
  content += `    Ok(Value::Null)\n`;
  content += `}\n`;
  content += `\`\`\`\n\n`;
  content += `## License\n\n`;
  content += `MIT\n`;

  await fs.writeFile(path.join(outputDir, 'README.md'), content, 'utf-8');
}

function toPascalCase(str: string): string {
  return str.replace(/(?:^|[-_])(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_');
}
