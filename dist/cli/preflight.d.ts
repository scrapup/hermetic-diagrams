import type { CaptureResult } from './docker-runner.js';
/**
 * Preflight probes (TF-79-03/04). Each probe is time-boxed; the sum of all time boxes stays under
 * {@link PREFLIGHT_BUDGET_MS}, far below the 240 s failure ceiling (spec §5), so `serve` reports a
 * missing prerequisite instead of letting the AI assistant time out.
 */
/** Runs `docker <args>` with stdout captured and a hard timeout. */
export type Capture = (args: readonly string[], timeoutMs: number) => Promise<CaptureResult>;
export type PreflightResult = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly reason: string;
};
export declare const RUNTIME_PROBE_MS = 20000;
export declare const COMPOSE_PROBE_MS = 10000;
export declare const IMAGES_LIST_PROBE_MS = 10000;
export declare const IMAGE_INSPECT_PROBE_MS = 10000;
/** Upper bound of all probes together (serve runs every one of them). */
export declare const PREFLIGHT_BUDGET_MS: number;
/**
 * Minimum Docker Compose version. The CLI relies on `up --wait/--wait-timeout`, `up --pull never`,
 * `up --no-build` and `run --pull never`; 2.24.0 is chosen conservatively to cover all of them.
 */
export declare const MIN_COMPOSE_VERSION = "2.24.0";
/** Docker is reachable and runs Linux containers. */
export declare function checkRuntime(capture: Capture): Promise<PreflightResult>;
/** Docker Compose v2 is available and recent enough. */
export declare function checkCompose(capture: Capture): Promise<PreflightResult>;
/**
 * Every image this version needs exists locally — never pulls or builds. `composeArgs` is the
 * `compose -f <file>` prefix. `required` lists images that `config --images` does not report
 * (the MCP gateway sits behind the `gateway` profile, so compose omits it from that listing).
 */
export declare function checkImages(capture: Capture, composeArgs: readonly string[], required: readonly string[], hint: string): Promise<PreflightResult>;
/** Run probes in order, stopping at the first failure. */
export declare function runPreflight(probes: readonly (() => Promise<PreflightResult>)[]): Promise<PreflightResult>;
/** `v2.29.1`, `2.29.1-desktop.1`, `5.3.1` → `2.29.1` / `5.3.1`. */
export declare function parseComposeVersion(raw: string): string | undefined;
/** Numeric compare of `x.y.z` strings: negative, zero or positive. */
export declare function compareVersions(a: string, b: string): number;
