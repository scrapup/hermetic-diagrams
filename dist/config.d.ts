/**
 * Runtime configuration. Every limit and endpoint is read from the environment with a safe
 * default so nothing is hardcoded inline (Zero Trust / no-hardcode). The MCP only ever talks to
 * the internal Kroki host — there is no configuration path to point it at a public server.
 */
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
}
export declare function loadConfig(): HermeticConfig;
