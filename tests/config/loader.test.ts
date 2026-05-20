import * as fs from 'fs-extra';
import * as path from 'path';
import { loadConfig, createDefaultConfig, validateConfig } from '../../src/config/loader';
import type { GraftConfig } from '../../src/types';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const TEST_OUTPUT_DIR = path.join(__dirname, '..', 'output');

describe('config/loader', () => {
  beforeEach(async () => {
    await fs.ensureDir(TEST_OUTPUT_DIR);
  });

  afterEach(async () => {
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
  });

  describe('loadConfig', () => {
    it('should load a valid graft.yml from explicit path', async () => {
      const configPath = path.join(FIXTURES_DIR, 'graft.yml');
      const config = await loadConfig(configPath);

      expect(config).toBeDefined();
      expect(config.spec).toBeDefined();
      expect(config.sdks).toHaveLength(2);
      expect(config.sdks[0].language).toBe('typescript');
      expect(config.sdks[1].language).toBe('python');
    });

    it('should resolve relative paths to absolute paths', async () => {
      const configPath = path.join(FIXTURES_DIR, 'graft.yml');
      const config = await loadConfig(configPath);

      expect(path.isAbsolute(config.spec)).toBe(true);
      expect(path.isAbsolute(config.sdks[0].output)).toBe(true);
    });

    it('should throw error for non-existent config file', async () => {
      const nonExistentPath = path.join(TEST_OUTPUT_DIR, 'non-existent.yml');
      
      await expect(loadConfig(nonExistentPath)).rejects.toThrow('No graft.yml configuration found');
    });

    it('should throw error for invalid YAML', async () => {
      const invalidConfigPath = path.join(TEST_OUTPUT_DIR, 'invalid.yml');
      await fs.writeFile(invalidConfigPath, 'invalid: yaml: content: [', 'utf-8');

      await expect(loadConfig(invalidConfigPath)).rejects.toThrow();
    });

    it('should throw error for missing required fields', async () => {
      const invalidConfigPath = path.join(TEST_OUTPUT_DIR, 'missing-fields.yml');
      await fs.writeFile(invalidConfigPath, 'spec: ./openapi.yaml\n', 'utf-8');

      await expect(loadConfig(invalidConfigPath)).rejects.toThrow('Invalid graft configuration');
    });

    it('should throw error for unsupported language', async () => {
      const invalidConfigPath = path.join(TEST_OUTPUT_DIR, 'bad-lang.yml');
      await fs.writeFile(
        invalidConfigPath,
        'spec: ./openapi.yaml\nsdks:\n  - language: csharp\n    output: ./sdks/csharp\n',
        'utf-8'
      );

      await expect(loadConfig(invalidConfigPath)).rejects.toThrow('Invalid graft configuration');
    });
  });

  describe('createDefaultConfig', () => {
    it('should create a default config file', async () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'graft.yml');
      await createDefaultConfig(outputPath);

      expect(await fs.pathExists(outputPath)).toBe(true);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('spec:');
      expect(content).toContain('sdks:');
      expect(content).toContain('mcp:');
    });

    it('should use specified language', async () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'graft-python.yml');
      await createDefaultConfig(outputPath, { language: 'python' });

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('language: python');
    });

    it('should use specified spec path', async () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'graft-custom.yml');
      await createDefaultConfig(outputPath, { spec: './api.yaml' });

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('spec: ./api.yaml');
    });
  });

  describe('validateConfig', () => {
    it('should pass for valid config', () => {
      const config: GraftConfig = {
        spec: '/path/to/spec.yaml',
        sdks: [
          {
            language: 'typescript',
            output: './output',
            package: '@test/sdk',
          },
        ],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw for missing spec', () => {
      const config = {
        spec: '',
        sdks: [{ language: 'typescript', output: './output' }],
      } as GraftConfig;

      expect(() => validateConfig(config)).toThrow('Configuration missing required field: spec');
    });

    it('should throw for empty SDKs array', () => {
      const config: GraftConfig = {
        spec: '/path/to/spec.yaml',
        sdks: [],
      };

      expect(() => validateConfig(config)).toThrow('Configuration must have at least one SDK target');
    });

    it('should throw for SDK missing output', () => {
      const config = {
        spec: '/path/to/spec.yaml',
        sdks: [{ language: 'typescript' }],
      } as GraftConfig;

      expect(() => validateConfig(config)).toThrow('SDK for typescript missing required field: output');
    });

    it('should warn for TypeScript SDK without package name', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config: GraftConfig = {
        spec: '/path/to/spec.yaml',
        sdks: [
          {
            language: 'typescript',
            output: './output',
          },
        ],
      };

      validateConfig(config);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Warning'));

      consoleSpy.mockRestore();
    });
  });
});
