import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('=======================================================');
console.log('  🚀 Starting LeakLens in Full-Stack Development Mode');
console.log('  Single command launching both Backend & Frontend');
console.log('  Press Ctrl + C at any time to stop both');
console.log('=======================================================\n');

// Prefix formatting
const colorReset = '\x1b[0m';
const colorBackend = '\x1b[36m'; // Cyan
const colorFrontend = '\x1b[35m'; // Magenta

function pipeOutput(childProcess, prefix, color) {
  const formatData = (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${color}${prefix}${colorReset} ${line}`);
      }
    });
  };

  childProcess.stdout.on('data', formatData);
  childProcess.stderr.on('data', formatData);
}

// 1. Launch Backend (port 3000)
const serverCmd = isWin ? 'npm.cmd --prefix server run dev' : 'npm --prefix server run dev';
const serverProc = spawn(serverCmd, {
  cwd: rootDir,
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});
pipeOutput(serverProc, '[BACKEND] ', colorBackend);

// 2. Launch Frontend (Vite port 5173)
const clientCmd = isWin ? 'npm.cmd --prefix client run dev' : 'npm --prefix client run dev';
const clientProc = spawn(clientCmd, {
  cwd: rootDir,
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});
pipeOutput(clientProc, '[FRONTEND]', colorFrontend);

// Clean termination of child processes
function cleanup() {
  console.log('\nStopping LeakLens backend and frontend...');
  if (isWin) {
    if (serverProc.pid) spawn('taskkill', ['/pid', serverProc.pid.toString(), '/T', '/F']);
    if (clientProc.pid) spawn('taskkill', ['/pid', clientProc.pid.toString(), '/T', '/F']);
  } else {
    serverProc.kill('SIGINT');
    clientProc.kill('SIGINT');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
