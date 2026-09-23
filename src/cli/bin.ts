#!/usr/bin/env node
import { spawn, type StdioOptions } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCommand, type CliCommand } from './args.js';

/**
 * CLI/bin (TF-76-01). Orchestrates the Docker lifecycle only — it never processes diagram source
 * and makes no network call beyond invoking Docker. Cross-platform (Docker Desktop/WSL2 on
 * Windows). The MCP client runs this bin as the server command with no args → `serve`, which brings
 * Kroki up and attaches the client's stdio to an ephemeral gateway container.
 *
 * stdout is the MCP JSON-RPC channel during `serve`, so setup output is sent to stderr.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Installed layout: <pkg>/dist/cli/bin.js and <pkg>/compose.yaml.
const COMPOSE_FILE = path.resolve(HERE, '..', '..', 'compose.yaml');

function runDocker(args: readonly string[], stdio: StdioOptions): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['compose', '-f', COMPOSE_FILE, ...args], { stdio });
    child.on('error', (err) => {
      process.stderr.write(`hermetic-diagrams: failed to run docker (${err.message}). Is Docker installed and running?\n`);
      resolve(127);
    });
    child.on('close', (code) => resolve(code ?? 0));
  });
}

/** Bring Kroki up (pulling by digest on first run); progress goes to stderr, never stdout. */
async function ensureKrokiUp(): Promise<number> {
  process.stderr.write('hermetic-diagrams: starting the contained rendering stack…\n');
  // Pipe stdout→stderr so first-run pull progress never corrupts the MCP stream.
  return runDocker(['up', '-d', 'kroki'], ['inherit', process.stderr, 'inherit']);
}

async function serve(): Promise<number> {
  const up = await ensureKrokiUp();
  if (up !== 0) return up;
  // Attach the client's stdio to an ephemeral gateway container.
  return runDocker(['run', '-T', '--rm', 'mcp'], 'inherit');
}

function printHelp(): void {
  process.stderr.write(
    [
      'hermetic-diagrams — hermetic, anti-exfiltration diagram rendering MCP',
      '',
      'Usage: hermetic-diagrams [command]',
      '',
      'Commands:',
      '  serve   (default) bring up Kroki and serve the MCP over stdio',
      '  up      start the contained stack (kroki) in the background',
      '  down    stop the stack and remove volumes',
      '  pull    pre-pull the pinned images by digest',
      '  help    show this help',
      '',
    ].join('\n'),
  );
}

async function dispatch(command: CliCommand): Promise<number> {
  switch (command) {
    case 'serve':
      return serve();
    case 'up':
      return runDocker(['up', '-d', 'kroki'], 'inherit');
    case 'down':
      return runDocker(['down', '-v'], 'inherit');
    case 'pull':
      return runDocker(['pull'], 'inherit');
    case 'help':
      printHelp();
      return 0;
  }
}

const command = parseCommand(process.argv.slice(2));
dispatch(command)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    process.stderr.write(`hermetic-diagrams: ${err instanceof Error ? err.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  });
