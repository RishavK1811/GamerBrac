import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  const backendDir = path.resolve(__dirname, '../../backend');
  console.log('Cleaning up isolated test_e2e.db database...');
  execSync('.venv/bin/python3 scripts/cleanup_test_db.py', {
    cwd: backendDir,
    stdio: 'inherit',
  });
}
