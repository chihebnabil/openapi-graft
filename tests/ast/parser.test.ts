import {
  parseSource,
  extractAnnotations,
  injectAnnotation,
  serializeAST,
  findNodeByAnnotationId,
} from '../../src/ast/parser';
import type { GraftAnnotation } from '../../src/types';

describe('ast/parser', () => {
  describe('parseSource', () => {
    it('should parse TypeScript source code', async () => {
      const source = `
export class UserClient {
  async getUser(id: string): Promise<User> {
    return this.request('/users/' + id);
  }
}
      `.trim();

      const ast = await parseSource(source, 'typescript');
      
      expect(ast).toBeDefined();
      expect(ast.type).toMatch(/^(source_file|program)$/);
      expect(ast.children.length).toBeGreaterThan(0);
    });

    it('should parse Python source code', async () => {
      const source = `
class UserClient:
    async def get_user(self, id: str) -> User:
        return await self.request(f'/users/{id}')
      `.trim();

      const ast = await parseSource(source, 'python');
      
      expect(ast).toBeDefined();
      expect(ast.type).toMatch(/^(source_file|module)$/);
    });

    it('should parse Go source code', async () => {
      const source = `
package client

type UserClient struct {
    BaseURL string
}

func (c *UserClient) GetUser(id string) (*User, error) {
    return c.Request("/users/" + id)
}
      `.trim();

      const ast = await parseSource(source, 'go');
      
      expect(ast).toBeDefined();
      expect(ast.type).toMatch(/^(source_file|source_file)$/);
    });

    it('should parse Java source code', async () => {
      const source = `
public class UserClient {
    public User getUser(String id) {
        return request("/users/" + id);
    }
}
      `.trim();

      const ast = await parseSource(source, 'java');
      
      expect(ast).toBeDefined();
      expect(ast.type).toMatch(/^(source_file|program)$/);
    });

    it('should parse Rust source code', async () => {
      const source = `
pub struct UserClient {
    base_url: String,
}

impl UserClient {
    pub async fn get_user(&self, id: &str) -> Result<User> {
        self.request(&format!("/users/{}", id)).await
    }
}
      `.trim();

      const ast = await parseSource(source, 'rust');
      
      expect(ast).toBeDefined();
      expect(ast.type).toMatch(/^(source_file|source_file)$/);
    });

    it('should handle empty source', async () => {
      const ast = await parseSource('', 'typescript');
      
      expect(ast).toBeDefined();
      expect(ast.type).toMatch(/^(source_file|program)$/);
    });
  });

  describe('extractAnnotations', () => {
    it('should extract TypeScript annotations', () => {
      const source = `
// @graft(preserve) id="custom-method"
async customMethod(): Promise<void> {
  console.log('custom');
}

// @graft(replace) id="override-method"
function overrideMethod() {
  return 'overridden';
}
      `.trim();

      const annotations = extractAnnotations(source, 'typescript');
      
      expect(annotations).toHaveLength(2);
      expect(annotations[0].annotation.type).toBe('preserve');
      expect(annotations[0].annotation.id).toBe('custom-method');
      expect(annotations[1].annotation.type).toBe('replace');
      expect(annotations[1].annotation.id).toBe('override-method');
    });

    it('should extract Python annotations', () => {
      const source = `
# @graft(preserve) id="custom-handler"
async def custom_handler(request):
    return {"custom": True}

# @graft(extend) id="addon"
def addon_function():
    pass
      `.trim();

      const annotations = extractAnnotations(source, 'python');
      
      expect(annotations).toHaveLength(2);
      expect(annotations[0].annotation.type).toBe('preserve');
      expect(annotations[0].annotation.id).toBe('custom-handler');
      expect(annotations[1].annotation.type).toBe('extend');
    });

    it('should extract Go annotations', () => {
      const source = `
// @graft(preserve) id="custom-func"
func CustomFunc() string {
    return "custom"
}
      `.trim();

      const annotations = extractAnnotations(source, 'go');
      
      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation.type).toBe('preserve');
      expect(annotations[0].annotation.id).toBe('custom-func');
    });

    it('should extract Java annotations', () => {
      const source = `
// @graft(preserve) id="custom-method"
public String customMethod() {
    return "custom";
}
      `.trim();

      const annotations = extractAnnotations(source, 'java');
      
      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation.type).toBe('preserve');
      expect(annotations[0].annotation.id).toBe('custom-method');
    });

    it('should extract Rust annotations', () => {
      const source = `
/// @graft(preserve) id="custom-fn"
pub fn custom_fn() -> String {
    String::from("custom")
}
      `.trim();

      const annotations = extractAnnotations(source, 'rust');
      
      expect(annotations).toHaveLength(1);
      expect(annotations[0].annotation.type).toBe('preserve');
      expect(annotations[0].annotation.id).toBe('custom-fn');
    });

    it('should return empty array when no annotations', () => {
      const source = `
function noAnnotation() {
  return 'hello';
}
      `.trim();

      const annotations = extractAnnotations(source, 'typescript');
      
      expect(annotations).toEqual([]);
    });

    it('should capture block text', () => {
      const source = `
// @graft(preserve) id="test-block"
function testBlock() {
  return 42;
}
      `.trim();

      const annotations = extractAnnotations(source, 'typescript');
      
      expect(annotations[0].blockText).toContain('function testBlock');
      expect(annotations[0].blockText).toContain('return 42');
    });
  });

  describe('injectAnnotation', () => {
    it('should inject TypeScript annotation', () => {
      const source = 'function test() {}';
      const annotation: GraftAnnotation = {
        type: 'preserve',
        id: 'test-func',
        language: 'typescript',
      };

      const result = injectAnnotation(source, annotation, 0, 'typescript');
      
      expect(result).toContain('// @graft(preserve) id="test-func"');
      expect(result).toContain('function test() {}');
    });

    it('should inject Python annotation', () => {
      const source = 'def test():\n    pass';
      const annotation: GraftAnnotation = {
        type: 'replace',
        id: 'test-func',
        language: 'python',
      };

      const result = injectAnnotation(source, annotation, 0, 'python');
      
      expect(result).toContain('# @graft(replace) id="test-func"');
      expect(result).toContain('def test():');
    });

    it('should inject Rust annotation with doc comment style', () => {
      const source = 'fn test() {}';
      const annotation: GraftAnnotation = {
        type: 'extend',
        id: 'test-fn',
        language: 'rust',
      };

      const result = injectAnnotation(source, annotation, 0, 'rust');
      
      expect(result).toContain('/// @graft(extend) id="test-fn"');
    });
  });

  describe('serializeAST', () => {
    it('should return node text', () => {
      const node = {
        type: 'test',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 4 },
        text: 'test',
        children: [],
      };

      expect(serializeAST(node)).toBe('test');
    });
  });

  describe('findNodeByAnnotationId', () => {
    it('should find node by annotation ID', () => {
      const node = {
        type: 'root',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
        text: '',
        children: [
          {
            type: 'child',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 0 },
            text: '',
            children: [],
            metadata: { annotationId: 'target-id' },
          },
        ],
      };

      const found = findNodeByAnnotationId(node, 'target-id');
      
      expect(found).toBeDefined();
      expect(found?.type).toBe('child');
    });

    it('should return null when not found', () => {
      const node = {
        type: 'root',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
        text: '',
        children: [],
      };

      const found = findNodeByAnnotationId(node, 'missing-id');
      
      expect(found).toBeNull();
    });
  });
});
