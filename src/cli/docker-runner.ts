import { spawn as nodeSpawn, type StdioOptions } from 'node:child_process';

/**
 * Process adapter for the Docker CLI (TF-79-03). Every call is bounded when a timeout is given, so
 * no probe can hang the CLI past its time box. It never processes diagram source.
 */

/** Exit code when the process cannot be spawned (e.g. `docker` not on PATH). */
export const EXIT_SPAWN_ERROR = 127;
/** Exit code when the process is killed at its timeout (same as coreutils `timeout`). */
export const EXIT_TIMEOUT = 124;

export type Spawn = typeof nodeSpawn;

export interface RunOptions {
  readonly stdio: StdioOptions;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

export interface CaptureResult {
  readonly code: number;
  readonly stdout: string;
  readonly timedOut: boolean;
}

/** Run `command args`, resolving its exit code (127 spawn error, 124 timeout). */
export function runProcess(
  command: string,
  args: readonly string[],
  options: RunOptions,
  spawn: Spawn = nodeSpawn,
): Promise<number> {
  return execute(command, args, options, spawn).then((r) => r.code);
}

/** Run `command args` with stdout captured (stderr discarded), bounded by `timeoutMs`. */
export function captureProcess(
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv; readonly timeoutMs: number },
  spawn: Spawn = nodeSpawn,
): Promise<CaptureResult> {
  return execute(command, args, { ...options, stdio: ['ignore', 'pipe', 'ignore'] }, spawn);
}

function execute(
  command: string,
  args: readonly string[],
  options: RunOptions,
  spawn: Spawn,
): Promise<CaptureResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let timedOut = false;
    let settled = false;
    const settle = (result: CaptureResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(command, [...args], { stdio: options.stdio, env: options.env });
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill();
            settle({ code: EXIT_TIMEOUT, stdout, timedOut });
          }, options.timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.on('error', () => settle({ code: EXIT_SPAWN_ERROR, stdout, timedOut }));
    child.on('close', (code) => settle({ code: code ?? 1, stdout, timedOut }));
  });
}
