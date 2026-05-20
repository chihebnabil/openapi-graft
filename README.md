# openapi-graft

OpenAPI SDK generator with AST-level 3-way merge for preserved custom code, plus MCP server scaffolding.

## Features

- **Multi-language SDK generation**: TypeScript, Python, Go, Java, Rust
- **AST-level 3-way merge**: Preserves custom code across regenerations using `@graft` annotations
- **MCP server scaffolding**: Generate Model Context Protocol servers from the same OpenAPI spec
- **CI-native**: Runs as a CLI tool, no cloud dependency
- **Validation**: Compiles merged output before writing to disk, fails CI if custom code breaks

## Quick Start

```bash
# Install globally
npm install -g openapi-graft

# Or use with npx
npx openapi-graft init
npx openapi-graft generate
```

## How It Works

Graft uses annotated regions for code preservation across regenerations:

| Layer | Function |
|-------|----------|
| Parser | Tree-sitter based - TypeScript, Python, Go, Java, Rust |
| Base | Previous clean generation (stored in `.graft/base/`) |
| Ours | Current working SDK with custom code |
| Theirs | New generation from updated OpenAPI spec |
| Merge Engine | Identifies `@graft(preserve)` annotated blocks, merges them into new generated classes |
| Validator | Compiles the merged output before writing - fails CI if custom code broke the new interface |

## Configuration

Create a `graft.yml` in your project root:

```yaml
spec: ./openapi.json
sdks:
  - language: typescript
    output: ./sdks/ts
    package: "@yourcompany/sdk"
    preserve:
      - ./sdks/ts/src/custom/**/*.ts  # auto-annotated on first run
  - language: python
    output: ./sdks/python
    package: "yourcompany-sdk"
  - language: go
    output: ./sdks/go
    package: "github.com/yourcompany/sdk"
mcp:
  enabled: true
  output: ./mcp-server
```

## Preserving Custom Code

Use `@graft` annotations to mark code that should survive regeneration:

### TypeScript
```typescript
// @graft(preserve) id="custom-validation"
async validateCustom(request: Request): Promise<Response> {
  // Your custom implementation
  // This survives SDK regeneration
}
```

### Python
```python
# @graft(preserve) id="custom-validation"
async def validate_custom(self, request):
    # Your custom implementation
    # This survives SDK regeneration
    pass
```

### Go
```go
// @graft(preserve) id="custom-handler"
func (api *API) CustomHandler(ctx context.Context, req Request) (*Response, error) {
    // Custom implementation survives regeneration
}
```

### Java
```java
// @graft(preserve) id="custom-handler"
public Object customHandler(String param) throws SDKException {
    // Custom implementation survives regeneration
}
```

### Rust
```rust
/// @graft(preserve) id="custom-handler"
pub async fn custom_handler(&self, param: String) -> GraftResult<Value> {
    // Custom implementation survives regeneration
    Ok(Value::Null)
}
```

## CLI Commands

```bash
# Initialize a new graft.yml
graft init

# Generate all SDKs
graft generate

# Generate MCP server
graft mcp

# Perform manual 3-way merge
graft merge --base ./base --ours ./ours --theirs ./theirs --language typescript --output ./merged

# Show status
graft status
```

## Why Graft?

| Feature | OpenAPI Generator | Fern | Graft |
|---------|------------------|------|-------|
| Custom code survives regen | ❌ Overwritten | ⚠️ .fernignore (manual) | ✅ AST merge with annotations |
| MCP server from same spec | ❌ No | ❌ No | ✅ Built-in |
| Self-hosted / air-gapped | ✅ Yes | ⚠️ Docker only | ✅ CLI-native, no cloud |
| Idiomatic output quality | ❌ Generic | ✅ High | ✅ Template-based |

## License

MIT
