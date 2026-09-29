import { spawn as nodeSpawn, type StdioOptions } from 'node:child_process';
/**
 * Process adapter for the Docker CLI (TF-79-03). Every call is bounded when a timeout is given, so
 * no probe can hang the CLI past its time box. It never processes diagram source.
 */
/** Exit code when the process cannot be spawned (e.g. `docker` not on PATH). */
export declare const EXIT_SPAWN_ERROR = 127;
/** Exit code when the process is killed at its timeout (same as coreutils `timeout`). */
export declare const EXIT_TIMEOUT = 124;
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
export declare function runProcess(command: string, args: readonly string[], options: RunOptions, spawn?: Spawn): Promise<number>;
/** Run `command args` with stdout captured (stderr discarded), bounded by `timeoutMs`. */
export declare function captureProcess(command: string, args: readonly string[], options: {
    readonly env: NodeJS.ProcessEnv;
    readonly timeoutMs: number;
}, spawn?: Spawn): Promise<CaptureResult>;
