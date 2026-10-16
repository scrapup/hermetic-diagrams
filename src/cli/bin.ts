#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCommand, type CliCommand } from './args.js';
import { serve, up, type CliContext, type StdioMode } from './commands.js';
import { captureProcess, runProcess } from './docker-runner.js';
import { readPackageVersion } from './version.js';

/**
 * CLI/bin (TF-76-01, TF-79-03/04). Thin dispatcher: orchestration lives in `commands.ts`. It
 * orchestrates the Docker lifecycle only — it never processes diagram source and makes no network
 * call beyond invoking Docker. Cross-platform (Docker Desktop/WSL2 on Windows).
 *
 * The AI assistant runs this bin (through npx) with no args → `serve`. The user runs `up` once per
 * version. stdout is the MCP JSON-RPC channel during `serve`, so setup output goes to stderr.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Installed layout: <pkg>/dist/cli/bin.js, <pkg>/compose.yaml, <pkg>/package.json.
const PACKAGE_ROOT = path.resolve(HERE, '..', '..');
const COMPOSE_ARGS = ['compose', '-f', path.join(PACKAGE_ROOT, 'compose.yaml')] as const;

function log(line: string): void {
  process.stderr.write(`hermetic-diagrams: ${line}\n`);
}

function context(version: string): CliContext {
  const env = { ...process.env, HD_VERSION: version };
  return {
    version,
    composeArgs: COMPOSE_ARGS,
    docker: (args: readonly string[], mode: StdioMode) =>
      runProcess('docker', args, {
        env,
        // setup: pipe stdout→stderr so pull/build progress never corrupts the MCP stream.
        stdio: mode === 'attach' ? 'inherit' : ['ignore', process.stderr, 'inherit'],
      }),
    capture: (args, timeoutMs) => captureProcess('docker', args, { env, timeoutMs }),
    log,
    distPresent: () => existsSync(path.join(PACKAGE_ROOT, 'dist', 'index.js')),
  };
}

function printHelp(): void {
  process.stderr.write(
    [
      'hermetic-diagrams — hermetic, anti-exfiltration diagram rendering MCP',
      '',
      'Usage: hermetic-diagrams [command]',
      '',
      'Commands:',
      '  serve   (default) attach the MCP over stdio to the prepared version',
      '  up      prepare this version once: pull Kroki, build the MCP image, start and wait healthy',
      '  down    stop the stack and remove volumes',
      '  pull    pre-pull the pinned images by digest',
      '  help    show this help',
      '',
    ].join('\n'),
  );
}

async function dispatch(command: CliCommand): Promise<number> {
  if (command === 'help') {
    printHelp();
    return 0;
  }
  const ctx = context(readPackageVersion(PACKAGE_ROOT));
  switch (command) {
    case 'serve':
      return serve(ctx);
    case 'up':
      return up(ctx);
    case 'down':
      return ctx.docker([...COMPOSE_ARGS, 'down', '-v'], 'setup');
    case 'pull':
      return ctx.docker([...COMPOSE_ARGS, 'pull', '--ignore-buildable'], 'setup');
  }
}

const command = parseCommand(process.argv.slice(2));
dispatch(command)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    log(err instanceof Error ? err.message : 'unexpected error');
    process.exitCode = 1;
  });
