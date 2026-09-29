import type { CaptureResult } from './docker-runner.js';

/**
 * Preflight probes (TF-79-03/04). Each probe is time-boxed; the sum of all time boxes stays under
 * {@link PREFLIGHT_BUDGET_MS}, far below the 240 s failure ceiling (spec §5), so `serve` reports a
 * missing prerequisite instead of letting the AI assistant time out.
 */

/** Runs `docker <args>` with stdout captured and a hard timeout. */
export type Capture = (args: readonly string[], timeoutMs: number) => Promise<CaptureResult>;

export type PreflightResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export const RUNTIME_PROBE_MS = 20_000;
export const COMPOSE_PROBE_MS = 10_000;
export const IMAGES_LIST_PROBE_MS = 10_000;
export const IMAGE_INSPECT_PROBE_MS = 10_000;
/** Upper bound of all probes together (serve runs every one of them). */
export const PREFLIGHT_BUDGET_MS =
  RUNTIME_PROBE_MS + COMPOSE_PROBE_MS + IMAGES_LIST_PROBE_MS + IMAGE_INSPECT_PROBE_MS;

/**
 * Minimum Docker Compose version. The CLI relies on `up --wait/--wait-timeout`, `up --pull never`,
 * `up --no-build` and `run --pull never`; 2.24.0 is chosen conservatively to cover all of them.
 */
export const MIN_COMPOSE_VERSION = '2.24.0';

const OK: PreflightResult = { ok: true };
const fail = (reason: string): PreflightResult => ({ ok: false, reason });

/** Docker is reachable and runs Linux containers. */
export async function checkRuntime(capture: Capture): Promise<PreflightResult> {
  const r = await capture(['info', '--format', '{{.OSType}}'], RUNTIME_PROBE_MS);
  if (r.timedOut) return fail('Docker did not answer in time — make sure Docker Desktop/Engine is running.');
  if (r.code !== 0) return fail('Docker is not reachable — install and start Docker Desktop or Docker Engine.');
  const osType = r.stdout.trim();
  if (osType !== 'linux') {
    return fail(`Docker is running "${osType}" containers — switch Docker Desktop to Linux containers.`);
  }
  return OK;
}

/** Docker Compose v2 is available and recent enough. */
export async function checkCompose(capture: Capture): Promise<PreflightResult> {
  const r = await capture(['compose', 'version', '--short'], COMPOSE_PROBE_MS);
  const need = `Docker Compose ${MIN_COMPOSE_VERSION} or newer is required`;
  if (r.timedOut || r.code !== 0) return fail(`${need} (docker compose is not available).`);
  const found = parseComposeVersion(r.stdout);
  if (found === undefined) return fail(`${need} (could not read the installed version).`);
  if (compareVersions(found, MIN_COMPOSE_VERSION) < 0) return fail(`${need} (found ${found}).`);
  return OK;
}

/**
 * Every image this version needs exists locally — never pulls or builds. `composeArgs` is the
 * `compose -f <file>` prefix. `required` lists images that `config --images` does not report
 * (the MCP gateway sits behind the `gateway` profile, so compose omits it from that listing).
 */
export async function checkImages(
  capture: Capture,
  composeArgs: readonly string[],
  required: readonly string[],
  hint: string,
): Promise<PreflightResult> {
  const list = await capture([...composeArgs, 'config', '--images'], IMAGES_LIST_PROBE_MS);
  const listed = list.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
  if (list.timedOut || list.code !== 0 || listed.length === 0) {
    return fail(`could not resolve the images of this version — ${hint}`);
  }
  const images = [...new Set([...listed, ...required])];
  const inspect = await capture(
    ['image', 'inspect', '--format', '{{.Id}}', ...images],
    IMAGE_INSPECT_PROBE_MS,
  );
  if (inspect.timedOut || inspect.code !== 0) return fail(`this version is not prepared — ${hint}`);
  return OK;
}

/** Run probes in order, stopping at the first failure. */
export async function runPreflight(
  probes: readonly (() => Promise<PreflightResult>)[],
): Promise<PreflightResult> {
  for (const probe of probes) {
    const result = await probe();
    if (!result.ok) return result;
  }
  return OK;
}

/** `v2.29.1`, `2.29.1-desktop.1`, `5.3.1` → `2.29.1` / `5.3.1`. */
export function parseComposeVersion(raw: string): string | undefined {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(raw.trim());
  return m === null ? undefined : `${m[1]}.${m[2]}.${m[3]}`;
}

/** Numeric compare of `x.y.z` strings: negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
