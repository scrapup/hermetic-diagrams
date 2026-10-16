/**
 * Runtime configuration. Every limit and endpoint is read from the environment with a safe
 * default so nothing is hardcoded inline (Zero Trust / no-hardcode). The MCP only ever talks to
 * the internal Kroki host — there is no configuration path to point it at a public server.
 */
/** Read-only application root inside the `mcp` image; shipped assets live under `assets/`. */
export declare const APP_ROOT = "/app";
/**
 * `AWS_ICONS_ROOT` may only point inside `/app/assets` (baked, read-only). Anything else — relative,
 * escaping, or elsewhere on the filesystem — falls back to the default (`plan.md` §3.4).
 */
export declare function awsIconsRootFromEnv(raw: string | undefined): string;
export interface HermeticConfig {
    /** Base URL of the internal Kroki service. Internal DNS only; never a public host. */
    readonly krokiBaseUrl: string;
    /** Max accepted source size in bytes (UTF-8), enforced by the PEP before sending. */
    readonly maxSourceBytes: number;
    /** Per-render timeout in ms, enforced by the Kroki client via AbortController. */
    readonly renderTimeoutMs: number;
    /** Max accepted rendered output size in bytes, rejected before base64 over stdio. */
    readonly maxOutputBytes: number;
    /** Max concurrent renders; overflow queues behind a semaphore. */
    readonly maxConcurrency: number;
    /** Egress self-check target — a fixed public IP:port a connection to which proves egress. */
    readonly egressCheckHost: string;
    readonly egressCheckPort: number;
    /** Egress self-check connect timeout in ms. */
    readonly egressCheckTimeoutMs: number;
    /** Max size in bytes of the source after `AWSPuml/` expansion; always ≥ `maxSourceBytes`. */
    readonly maxExpandedSourceBytes: number;
    /** Max distinct `AWSPuml/` includes per source (local-DoS bound). */
    readonly maxAwsIncludes: number;
    /** Directory holding the vendored icon set (`<tag>/`); always inside `/app/assets`. */
    readonly awsIconsRoot: string;
    /** The icon-set lock baked next to the package (`/app/aws-icons.lock.json`); not configurable. */
    readonly awsIconsLockPath: string;
    /** Shipped authoring guides (`/app/assets/guides`); not configurable. */
    readonly guidesRoot: string;
}
/** The expanded limit can never be tighter than the raw-source limit; if it is, use the default. */
export declare function expandedLimit(maxSourceBytes: number, configured: number): number;
export declare function loadConfig(): HermeticConfig;
