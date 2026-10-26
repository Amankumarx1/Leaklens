import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Security & Secret Leakage Prevention Checks', () => {
  it('should not contain filled credentials in .env.example', () => {
    const envExamplePath = path.join(rootDir, '.env.example');
    const content = fs.readFileSync(envExamplePath, 'utf8');

    // DB_PASSWORD and SESSION_SECRET should be empty in example template
    expect(content).toMatch(/DB_PASSWORD=\s*(\r?\n|$)/);
    expect(content).toMatch(/SESSION_SECRET=\s*(\r?\n|$)/);
  });

  it('should ensure .env is registered in .gitignore', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');

    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('node_modules');
  });

  it('should verify that real sensitive AWS keys or private keys are not hardcoded in source', () => {
    const checkDirectories = [
      path.join(rootDir, 'server', 'src'),
      path.join(rootDir, 'client', 'src'),
      path.join(rootDir, 'database')
    ];

    function scanDir(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.sql'))) {
          const fileContent = fs.readFileSync(fullPath, 'utf8');

          // AWS access key ID format check
          expect(fileContent).not.toMatch(/AKIA[0-9A-Z]{16}/);

          // RSA Private key check
          expect(fileContent).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
          expect(fileContent).not.toContain('-----BEGIN PRIVATE KEY-----');
        }
      }
    }

    for (const dir of checkDirectories) {
      scanDir(dir);
    }
  });
});
