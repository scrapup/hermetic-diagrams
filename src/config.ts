/**
 * Runtime configuration. Every limit and endpoint is read from the environment with a safe
 * default so nothing is hardcoded inline (Zero Trust / no-hardcode). The MCP only ever talks to
 * the internal Kroki host — there is no configuration path to point it at a public server.
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

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

export function loadConfig(): HermeticConfig {
  return {
    krokiBaseUrl: process.env['KROKI_BASE_URL']?.trim() || 'http://kroki:8000',
    maxSourceBytes: intFromEnv('MAX_SOURCE_BYTES', 256 * 1024),
    renderTimeoutMs: intFromEnv('RENDER_TIMEOUT_MS', 15_000),
    maxOutputBytes: intFromEnv('MAX_OUTPUT_BYTES', 8 * 1024 * 1024),
    maxConcurrency: intFromEnv('MAX_CONCURRENCY', 4),
    // 1.1.1.1 (Cloudflare) is a globally-routed anycast IP reachable on :443 from any host with
    // egress. The probe is a SYN-only TCP connect: if the handshake COMPLETES, an external route
    // exists → NOT_CONTAINED. In a contained `internal: true` network there is no route, so the
    // connect errors or times out → contained. A documentation/TEST-NET IP would be wrong here:
    // it never connects even with egress, yielding a false "contained".
    egressCheckHost: process.env['EGRESS_CHECK_HOST']?.trim() || '1.1.1.1',
    egressCheckPort: intFromEnv('EGRESS_CHECK_PORT', 443),
    egressCheckTimeoutMs: intFromEnv('EGRESS_CHECK_TIMEOUT_MS', 1_500),
  };
}
