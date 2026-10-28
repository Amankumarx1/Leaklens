import fs from 'fs';
import path from 'path';
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distHtml = path.resolve(rootDir, 'client/dist/index.html');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('=======================================================');
console.log('  🛡️  LeakLens Production Unified Server');
console.log('  Single Process Serving Both UI & REST APIs');
console.log('=======================================================\n');

// 1. Verify if frontend production bundle is compiled
if (!fs.existsSync(distHtml)) {
  console.log('[Build] Frontend build not detected. Compiling client bundle...');
  const buildCmd = isWin ? 'npm.cmd --prefix client run build' : 'npm --prefix client run build';
  const buildResult = spawnSync(buildCmd, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  });
  if (buildResult.status !== 0) {
    console.error('[Build Error] Failed to compile client bundle.');
    process.exit(1);
  }
  console.log('[Build] Client bundle compiled successfully.\n');
}

// 2. Launch Server (serves API on /api and static client on /)
const startCmd = isWin ? 'npm.cmd --prefix server start' : 'npm --prefix server start';
const serverProc = spawn(startCmd, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\nStopping LeakLens unified server...');
  if (isWin && serverProc.pid) {
    spawn('taskkill', ['/pid', serverProc.pid.toString(), '/T', '/F']);
  } else {
    serverProc.kill('SIGINT');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
