import * as path from 'path';
import { parseSpec, getAllOperations, getAllSchemas, getTags } from '../../src/parser/openapi';
import { loadConfig } from '../../src/config/loader';

describe('integration: example fixtures', () => {
  const EXAMPLES_DIR = path.join(__dirname, '..', '..', 'examples');

  it('should parse the example openapi.yaml', async () => {
    const specPath = path.join(EXAMPLES_DIR, 'openapi.yaml');
    
    // Skip if examples/openapi.yaml is empty or missing
    const fs = await import('fs-extra');
    const stats = await fs.stat(specPath).catch(() => null);
    
    if (!stats || stats.size === 0) {
      console.log('Skipping: examples/openapi.yaml is empty');
      return;
    }

    const spec = await parseSpec(specPath);
    
    expect(spec).toBeDefined();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info).toBeDefined();
    
    const operations = getAllOperations(spec);
    expect(operations.length).toBeGreaterThan(0);
    
    const schemas = getAllSchemas(spec);
    expect(schemas.length).toBeGreaterThan(0);
    
    const tags = getTags(spec);
    expect(tags.length).toBeGreaterThan(0);
  }, 30000);

  it('should load the example graft.yml', async () => {
    const configPath = path.join(EXAMPLES_DIR, 'graft.yml');
    
    const fs = await import('fs-extra');
    const exists = await fs.pathExists(configPath);
    
    if (!exists) {
      console.log('Skipping: examples/graft.yml not found');
      return;
    }

    const config = await loadConfig(configPath);
    
    expect(config).toBeDefined();
    expect(config.sdks).toBeDefined();
    expect(config.sdks.length).toBeGreaterThan(0);
    expect(config.mcp).toBeDefined();
    
    // Verify all supported languages are present
    const languages = config.sdks.map(s => s.language);
    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
    expect(languages).toContain('go');
    expect(languages).toContain('java');
    expect(languages).toContain('rust');
  });
});
