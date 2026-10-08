#!/usr/bin/env node
// Runs the bot and the dashboard together in one process tree, so a single
// container (the common case when a host's "Dockerfile app" deploy type
// ignores docker-compose.yml's multi-service split) still serves both.
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const root = path.join(__dirname, '..');
const children = [];
let shuttingDown = false;

function run(name, scriptPath) {
  const child = spawn(process.execPath, [scriptPath], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

  for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    readline.createInterface({ input: stream }).on('line', (line) => out.write(`[${name}] ${line}\n`));
  }

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${name}] exited unexpectedly (code=${code}, signal=${signal}) — stopping both processes.`);
    shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(exitCode);
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

run('bot', path.join(root, 'src', 'index.js'));
run('dashboard', path.join(root, 'dashboard', 'server.js'));
