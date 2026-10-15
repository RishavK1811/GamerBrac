import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  const backendDir = path.resolve(__dirname, '../../backend');
  console.log('Initializing isolated test_e2e.db database...');
  execSync('.venv/bin/python3 scripts/setup_test_db.py', {
    cwd: backendDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'sqlite:///./test_e2e.db',
    },
  });
}
