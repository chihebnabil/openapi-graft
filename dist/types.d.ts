/**
 * Core types for the Graft SDK generator
 */
export interface OpenAPISpec {
    openapi: string;
    info: InfoObject;
    servers?: ServerObject[];
    paths: Record<string, PathItemObject>;
    components?: ComponentsObject;
    tags?: TagObject[];
}
export interface InfoObject {
    title: string;
    description?: string;
    version: string;
    contact?: ContactObject;
    license?: LicenseObject;
}
export interface ContactObject {
    name?: string;
    url?: string;
    email?: string;
}
export interface LicenseObject {
    name: string;
    url?: string;
}
export interface ServerObject {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariableObject>;
}
export interface ServerVariableObject {
    enum?: string[];
    default: string;
    description?: string;
}
export interface PathItemObject {
    summary?: string;
    description?: string;
    get?: OperationObject;
    put?: OperationObject;
    post?: OperationObject;
    delete?: OperationObject;
    options?: OperationObject;
    head?: OperationObject;
    patch?: OperationObject;
    trace?: OperationObject;
    servers?: ServerObject[];
    parameters?: (ParameterObject | ReferenceObject)[];
}
export interface OperationObject {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    parameters?: (ParameterObject | ReferenceObject)[];
    requestBody?: RequestBodyObject | ReferenceObject;
    responses: Record<string, ResponseObject | ReferenceObject>;
    deprecated?: boolean;
    security?: SecurityRequirementObject[];
}
export interface ParameterObject {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema?: SchemaObject | ReferenceObject;
    example?: unknown;
    examples?: Record<string, ExampleObject | ReferenceObject>;
}
export interface RequestBodyObject {
    description?: string;
    content: Record<string, MediaTypeObject>;
    required?: boolean;
}
export interface ResponseObject {
    description: string;
    headers?: Record<string, HeaderObject | ReferenceObject>;
    content?: Record<string, MediaTypeObject>;
}
export interface MediaTypeObject {
    schema?: SchemaObject | ReferenceObject;
    example?: unknown;
    examples?: Record<string, ExampleObject | ReferenceObject>;
}
export interface SchemaObject {
    type?: string;
    format?: string;
    nullable?: boolean;
    enum?: unknown[];
    default?: unknown;
    description?: string;
    properties?: Record<string, SchemaObject | ReferenceObject>;
    required?: string[];
    items?: SchemaObject | ReferenceObject;
    additionalProperties?: boolean | SchemaObject | ReferenceObject;
    allOf?: (SchemaObject | ReferenceObject)[];
    oneOf?: (SchemaObject | ReferenceObject)[];
    anyOf?: (SchemaObject | ReferenceObject)[];
    $ref?: string;
    readOnly?: boolean;
    writeOnly?: boolean;
    deprecated?: boolean;
    title?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
}
export interface ExampleObject {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
}
export interface HeaderObject {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema?: SchemaObject | ReferenceObject;
}
export interface ComponentsObject {
    schemas?: Record<string, SchemaObject | ReferenceObject>;
    responses?: Record<string, ResponseObject | ReferenceObject>;
    parameters?: Record<string, ParameterObject | ReferenceObject>;
    examples?: Record<string, ExampleObject | ReferenceObject>;
    requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
    headers?: Record<string, HeaderObject | ReferenceObject>;
    securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
}
export interface SecuritySchemeObject {
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    description?: string;
    name?: string;
    in?: string;
    scheme?: string;
    bearerFormat?: string;
    flows?: OAuthFlowsObject;
    openIdConnectUrl?: string;
}
export interface OAuthFlowsObject {
    implicit?: OAuthFlowObject;
    password?: OAuthFlowObject;
    clientCredentials?: OAuthFlowObject;
    authorizationCode?: OAuthFlowObject;
}
export interface OAuthFlowObject {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
}
export interface SecurityRequirementObject {
    [name: string]: string[];
}
export interface TagObject {
    name: string;
    description?: string;
}
export interface ReferenceObject {
    $ref: string;
}
export interface GraftConfig {
    spec: string;
    sdks: SDKConfig[];
    mcp?: MCPConfig;
    baseDir?: string;
}
export interface SDKConfig {
    language: SupportedLanguage;
    output: string;
    package?: string;
    preserve?: string[];
    templates?: string;
    options?: Record<string, unknown>;
}
export type SupportedLanguage = 'typescript' | 'python' | 'go' | 'java' | 'rust';
export interface MCPConfig {
    enabled: boolean;
    output: string;
    name?: string;
    version?: string;
}
export interface ASTNode {
    type: string;
    startPosition: Position;
    endPosition: Position;
    text: string;
    children: ASTNode[];
    metadata?: Record<string, unknown>;
}
export interface Position {
    row: number;
    column: number;
}
export interface GraftAnnotation {
    type: 'preserve' | 'replace' | 'extend';
    id: string;
    language: SupportedLanguage;
    metadata?: Record<string, unknown>;
}
export interface AnnotatedBlock {
    annotation: GraftAnnotation;
    node: ASTNode;
    originalText: string;
}
export interface MergeResult {
    success: boolean;
    output: string;
    conflicts: MergeConflict[];
    annotationsApplied: number;
}
export interface MergeConflict {
    block: AnnotatedBlock;
    baseText: string;
    oursText: string;
    theirsText: string;
    resolved: boolean;
    resolution?: string;
}
export interface GeneratedSDK {
    language: SupportedLanguage;
    files: GeneratedFile[];
    packageName: string;
}
export interface GeneratedFile {
    path: string;
    content: string;
    annotations?: GraftAnnotation[];
}
export interface MCPGeneratedServer {
    files: GeneratedFile[];
    tools: MCPTool[];
    resources: MCPResource[];
}
export interface MCPTool {
    name: string;
    description: string;
    parameters: SchemaObject;
    operationId: string;
}
export interface MCPResource {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}
export interface CLIOptions {
    config?: string;
    verbose?: boolean;
    dryRun?: boolean;
    ci?: boolean;
}
//# sourceMappingURL=types.d.ts.map