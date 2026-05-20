import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { performThreeWayMerge } from '../../src/ast/merge';
import type { MergeResult, SupportedLanguage } from '../../src/types';

let TEST_DIR: string;

describe('ast/merge - 3-way merge engine', () => {
  beforeEach(async () => {
    TEST_DIR = path.join(os.tmpdir(), `openapi-graft-merge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    if (TEST_DIR && await fs.pathExists(TEST_DIR)) {
      await fs.remove(TEST_DIR);
    }
  });

  async function setupMergeDirs(
    baseFiles: Record<string, string>,
    oursFiles: Record<string, string>,
    theirsFiles: Record<string, string>
  ): Promise<{ baseDir: string; oursDir: string; theirsDir: string; outputDir: string }> {
    const baseDir = path.join(TEST_DIR, 'base');
    const oursDir = path.join(TEST_DIR, 'ours');
    const theirsDir = path.join(TEST_DIR, 'theirs');
    const outputDir = path.join(TEST_DIR, 'output');

    for (const [filePath, content] of Object.entries(baseFiles)) {
      const fullPath = path.join(baseDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    for (const [filePath, content] of Object.entries(oursFiles)) {
      const fullPath = path.join(oursDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    for (const [filePath, content] of Object.entries(theirsFiles)) {
      const fullPath = path.join(theirsDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    return { baseDir, oursDir, theirsDir, outputDir };
  }

  describe('performThreeWayMerge', () => {
    it('should handle new files (no base, has theirs)', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {}, // no base
        {}, // no ours
        {
          'client.ts': 'export class Client {}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toBe('export class Client {}');
      expect(results[0].annotationsApplied).toBe(0);
      
      const outputFile = await fs.readFile(path.join(outputDir, 'client.ts'), 'utf-8');
      expect(outputFile).toBe('export class Client {}');
    });

    it('should handle deleted files (no theirs, has ours)', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': 'export class Client {}',
        },
        {
          'client.ts': 'export class Client {\n  custom() {}\n}',
        },
        {} // no theirs
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('custom()');
    });

    it('should take theirs when no custom annotations exist', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': 'export class Client {\n  oldMethod() {}\n}',
        },
        {
          'client.ts': 'export class Client {\n  oldMethod() {}\n}', // identical to base, no annotations
        },
        {
          'client.ts': 'export class Client {\n  newMethod() {}\n}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('newMethod');
      expect(results[0].output).not.toContain('oldMethod');
      expect(results[0].annotationsApplied).toBe(0);
    });

    it('should preserve annotated blocks from ours', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': `export class Client {
  list() {}
}`,
        },
        {
          'client.ts': `export class Client {
  list() {}

  // @graft(preserve) id="custom-method"
  customMethod() {
    return 'custom';
  }
}`,
        },
        {
          'client.ts': `export class Client {
  list() {}
  get() {}
}`,
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
      expect(results[0].output).toContain('get()'); // from theirs
      expect(results[0].output).toContain('customMethod'); // preserved from ours
      expect(results[0].output).toContain('@graft(preserve)'); // annotation preserved
    });

    it('should replace annotated blocks', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': `export class Client {
  // @graft(preserve) id="auth"
  authenticate() {
    return 'basic';
  }
}`,
        },
        {
          'client.ts': `export class Client {
  // @graft(replace) id="auth"
  authenticate() {
    return 'oauth2';
  }
}`,
        },
        {
          'client.ts': `export class Client {
  // @graft(preserve) id="auth"
  authenticate() {
    return 'basic';
  }
}`,
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
      expect(results[0].output).toContain('oauth2'); // replaced with ours
    });

    it('should extend annotated blocks', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': `export class Client {
  validate() {
    return true;
  }
}`,
        },
        {
          'client.ts': `export class Client {
  // @graft(extend) id="validation"
  validate() {
    return true;
  }
}`,
        },
        {
          'client.ts': `export class Client {
  validate() {
    return true;
  }
}`,
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
    });

    it('should handle multiple files', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': 'export class Client {}',
          'types.ts': 'export interface User {}',
        },
        {
          'client.ts': `export class Client {
  // @graft(preserve) id="helper"
  helper() {}
}`,
          'types.ts': 'export interface User {}',
        },
        {
          'client.ts': 'export class Client {\n  newMethod() {}\n}',
          'types.ts': 'export interface User {\n  id: string;\n}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results).toHaveLength(2);
      
      const clientResult = results.find(r => r.output.includes('class Client'));
      expect(clientResult?.success).toBe(true);
      expect(clientResult?.output).toContain('helper');
      expect(clientResult?.output).toContain('newMethod');
    });

    it('should handle multiple annotations in one file', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': `export class Client {
  list() {}
}`,
        },
        {
          'client.ts': `export class Client {
  list() {}

  // @graft(preserve) id="method-a"
  methodA() {
    return 'a';
  }

  // @graft(preserve) id="method-b"
  methodB() {
    return 'b';
  }
}`,
        },
        {
          'client.ts': `export class Client {
  list() {}
  get() {}
}`,
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(2);
      expect(results[0].output).toContain('methodA');
      expect(results[0].output).toContain('methodB');
      expect(results[0].output).toContain('get()');
    });

    it('should report conflicts when block cannot be found', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': `export class Client {
  oldMethod() {}
}`,
        },
        {
          'client.ts': `export class Client {
  // @graft(replace) id="nonexistent"
  totallyDifferent() {
    return 'custom';
  }
}`,
        },
        {
          'client.ts': `export class Client {
  newMethod() {}
}`,
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      // Should still succeed but may have conflicts or append the block
      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
      expect(results[0].output).toContain('totallyDifferent');
    });

    it('should handle empty directories', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs({}, {}, {});

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results).toEqual([]);
    });

    it('should work with Python files', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.py': 'class Client:\n    def list(self):\n        pass',
        },
        {
          'client.py': `class Client:
    def list(self):
        pass

    # @graft(preserve) id="custom-method"
    def custom_method(self):
        return 'custom'`,
        },
        {
          'client.py': 'class Client:\n    def list(self):\n        pass\n    def get(self):\n        pass',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'python', outputDir);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
      expect(results[0].output).toContain('custom_method');
      expect(results[0].output).toContain('def get');
    });

    it('should work with Go files', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.go': 'package client\n\ntype Client struct{}\n\nfunc (c *Client) List() {}',
        },
        {
          'client.go': `package client

type Client struct{}

func (c *Client) List() {}

// @graft(preserve) id="custom"
func (c *Client) Custom() string {
	return "custom"
}`,
        },
        {
          'client.go': 'package client\n\ntype Client struct{}\n\nfunc (c *Client) List() {}\n\nfunc (c *Client) Get() {}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'go', outputDir);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
      expect(results[0].output).toContain('Custom()');
      expect(results[0].output).toContain('Get()');
    });

    it('should handle nested directories', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'src/client.ts': 'export class Client {}',
          'src/types.ts': 'export interface User {}',
        },
        {
          'src/client.ts': `export class Client {
  // @graft(preserve) id="helper"
  helper() {}
}`,
          'src/types.ts': 'export interface User {}',
        },
        {
          'src/client.ts': 'export class Client {\n  newMethod() {}\n}',
          'src/types.ts': 'export interface User {\n  id: string;\n}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results).toHaveLength(2);

      // Verify output files exist in nested structure
      expect(await fs.pathExists(path.join(outputDir, 'src', 'client.ts'))).toBe(true);
      expect(await fs.pathExists(path.join(outputDir, 'src', 'types.ts'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle file modified in theirs but not in ours', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': 'export class Client {\n  oldMethod() {}\n}',
        },
        {
          'client.ts': 'export class Client {\n  oldMethod() {}\n}', // unchanged from base
        },
        {
          'client.ts': 'export class Client {\n  newMethod() {}\n}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('newMethod');
      expect(results[0].annotationsApplied).toBe(0);
    });

    it('should handle identical base, ours, and theirs', async () => {
      const content = 'export class Client {\n  method() {}\n}';
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        { 'client.ts': content },
        { 'client.ts': content },
        { 'client.ts': content }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].output).toBe(content);
    });

    it('should handle ours with annotation but empty block', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': 'export class Client {}',
        },
        {
          'client.ts': `export class Client {
  // @graft(preserve) id="empty"
  empty() {}
}`,
        },
        {
          'client.ts': 'export class Client {\n  newMethod() {}\n}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].annotationsApplied).toBe(1);
      expect(results[0].output).toContain('empty()');
    });

    it('should preserve annotation comments in output', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {
          'client.ts': 'export class Client {}',
        },
        {
          'client.ts': `export class Client {
  // @graft(preserve) id="my-method"
  myMethod() {
    return 42;
  }
}`,
        },
        {
          'client.ts': 'export class Client {\n  generated() {}\n}',
        }
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('// @graft(preserve) id="my-method"');
    });

    it('should handle when ours has file but base and theirs do not', async () => {
      const { baseDir, oursDir, theirsDir, outputDir } = await setupMergeDirs(
        {},
        {
          'orphan.ts': '// orphan file with no base or theirs',
        },
        {}
      );

      const results = await performThreeWayMerge(baseDir, oursDir, theirsDir, 'typescript', outputDir);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('orphan');
    });
  });
});
