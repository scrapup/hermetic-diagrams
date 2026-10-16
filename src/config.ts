/**
 * Runtime configuration. Every limit and endpoint is read from the environment with a safe
 * default so nothing is hardcoded inline (Zero Trust / no-hardcode). The MCP only ever talks to
 * the internal Kroki host — there is no configuration path to point it at a public server.
 */

import path from 'node:path';

/** Read-only application root inside the `mcp` image; shipped assets live under `assets/`. */
export const APP_ROOT = '/app';
const ASSETS_ROOT = path.posix.join(APP_ROOT, 'assets');
const DEFAULT_AWS_ICONS_ROOT = path.posix.join(ASSETS_ROOT, 'aws-icons');

/**
 * `AWS_ICONS_ROOT` may only point inside `/app/assets` (baked, read-only). Anything else — relative,
 * escaping, or elsewhere on the filesystem — falls back to the default (`plan.md` §3.4).
 */
export function awsIconsRootFromEnv(raw: string | undefined): string {
  const value = raw?.trim();
  if (value === undefined || value === '' || !path.posix.isAbsolute(value)) return DEFAULT_AWS_ICONS_ROOT;
  const resolved = path.posix.resolve(value);
  return resolved === ASSETS_ROOT || resolved.startsWith(`${ASSETS_ROOT}/`) ? resolved : DEFAULT_AWS_ICONS_ROOT;
}

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

const DEFAULT_MAX_EXPANDED_SOURCE_BYTES = 2 * 1024 * 1024;

/** The expanded limit can never be tighter than the raw-source limit; if it is, use the default. */
export function expandedLimit(maxSourceBytes: number, configured: number): number {
  return configured >= maxSourceBytes ? configured : Math.max(DEFAULT_MAX_EXPANDED_SOURCE_BYTES, maxSourceBytes);
}

export function loadConfig(): HermeticConfig {
  const maxSourceBytes = intFromEnv('MAX_SOURCE_BYTES', 256 * 1024);
  return {
    krokiBaseUrl: process.env['KROKI_BASE_URL']?.trim() || 'http://kroki:8000',
    maxSourceBytes,
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
    maxExpandedSourceBytes: expandedLimit(
      maxSourceBytes,
      intFromEnv('MAX_EXPANDED_SOURCE_BYTES', DEFAULT_MAX_EXPANDED_SOURCE_BYTES),
    ),
    maxAwsIncludes: intFromEnv('MAX_AWS_INCLUDES', 200),
    awsIconsRoot: awsIconsRootFromEnv(process.env['AWS_ICONS_ROOT']),
    awsIconsLockPath: path.posix.join(APP_ROOT, 'aws-icons.lock.json'),
    guidesRoot: path.posix.join(ASSETS_ROOT, 'guides'),
  };
}
