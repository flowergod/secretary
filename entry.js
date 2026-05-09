// Entry point that spawns server in a child process to avoid module caching issues
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'dist', 'server.js');
const serverProc = spawn(process.execPath, [serverPath], {
  stdio: ['inherit', 'pipe', 'pipe'],
  cwd: __dirname,
  detached: true
});

let started = false;

serverProc.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);

  if (text.includes('Started on')) {
    started = true;
    console.log('\n[Entry] Server has started successfully');
    // Keep the process running
  }
});

serverProc.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

serverProc.on('close', (code) => {
  if (!started && code !== 0) {
    console.error('[Entry] Server failed to start, exit code:', code);
    process.exit(code);
  }
});

// Prevent this process from exiting while server is running
process.stdin.resume();

// Handle signals
process.on('SIGINT', () => {
  serverProc.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProc.kill('SIGTERM');
  process.exit(0);
});