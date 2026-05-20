import * as fs from 'fs-extra';
import * as path from 'path';

// Clean up test output directories after tests
afterAll(async () => {
  const testOutputDir = path.join(process.cwd(), 'tests', 'output');
  if (await fs.pathExists(testOutputDir)) {
    await fs.remove(testOutputDir);
  }
});
