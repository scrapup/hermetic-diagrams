import type { Capture } from './preflight.js';
/**
 * `up` and `serve` orchestration (TF-79-03/04). `up` does all heavy work once per version;
 * `serve` never pulls or builds — it attaches to a prepared version or fails fast with the exact
 * `up` command (RN-03..RN-06). Diagnostics go to `log` (stderr), never to stdout (RN-11).
 */
/**
 * Bound for Kroki to become healthy. compose.yaml's healthcheck allows up to
 * start_period 20 s + 12 retries × 10 s = 140 s before it reports unhealthy; 180 s covers that
 * window plus container start.
 */
export declare const KROKI_WAIT_S = 180;
/** How a docker process is wired: `setup` keeps stdout off the MCP stream; `attach` hands it stdio. */
export type StdioMode = 'setup' | 'attach';
export interface CliContext {
    readonly version: string;
    /** `['compose', '-f', <compose.yaml>]`. */
    readonly composeArgs: readonly string[];
    readonly docker: (args: readonly string[], mode: StdioMode) => Promise<number>;
    readonly capture: Capture;
    readonly log: (line: string) => void;
    /** Whether the prebuilt `dist/` the image copies is present next to compose.yaml. */
    readonly distPresent: () => boolean;
}
export declare const EXIT_PREFLIGHT = 1;
/** One-time preparation: preflight → pull Kroki → build MCP image → start Kroki and wait healthy. */
export declare function up(ctx: CliContext): Promise<number>;
/** Per-session start: preflight (incl. images) → ensure Kroki → attach stdio to the gateway. */
export declare function serve(ctx: CliContext): Promise<number>;
