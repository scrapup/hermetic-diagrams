import { spawn as nodeSpawn } from 'node:child_process';
/**
 * Process adapter for the Docker CLI (TF-79-03). Every call is bounded when a timeout is given, so
 * no probe can hang the CLI past its time box. It never processes diagram source.
 */
/** Exit code when the process cannot be spawned (e.g. `docker` not on PATH). */
export const EXIT_SPAWN_ERROR = 127;
/** Exit code when the process is killed at its timeout (same as coreutils `timeout`). */
export const EXIT_TIMEOUT = 124;
/** Run `command args`, resolving its exit code (127 spawn error, 124 timeout). */
export function runProcess(command, args, options, spawn = nodeSpawn) {
    return execute(command, args, options, spawn).then((r) => r.code);
}
/** Run `command args` with stdout captured (stderr discarded), bounded by `timeoutMs`. */
export function captureProcess(command, args, options, spawn = nodeSpawn) {
    return execute(command, args, { ...options, stdio: ['ignore', 'pipe', 'ignore'] }, spawn);
}
function execute(command, args, options, spawn) {
    return new Promise((resolve) => {
        let stdout = '';
        let timedOut = false;
        let settled = false;
        const settle = (result) => {
            if (settled)
                return;
            settled = true;
            if (timer !== undefined)
                clearTimeout(timer);
            resolve(result);
        };
        const child = spawn(command, [...args], { stdio: options.stdio, env: options.env });
        const timer = options.timeoutMs === undefined
            ? undefined
            : setTimeout(() => {
                timedOut = true;
                child.kill();
                settle({ code: EXIT_TIMEOUT, stdout, timedOut });
            }, options.timeoutMs);
        child.stdout?.setEncoding('utf8');
        child.stdout?.on('data', (chunk) => {
            stdout += chunk;
        });
        child.on('error', () => settle({ code: EXIT_SPAWN_ERROR, stdout, timedOut }));
        child.on('close', (code) => settle({ code: code ?? 1, stdout, timedOut }));
    });
}
