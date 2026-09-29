import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/** Repo root (two levels up from test/helpers/). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COMPOSE_FILE = path.join(REPO_ROOT, 'compose.yaml');
const COMPOSE = ['compose', '-f', COMPOSE_FILE];

/** Package version; compose.yaml tags the MCP image with it (`${HD_VERSION:?}`). */
export const HD_VERSION = (
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string }
).version;
/** Environment for every compose call made by the tests. */
export const COMPOSE_ENV: NodeJS.ProcessEnv = { ...process.env, HD_VERSION };

export async function compose(
  args: readonly string[],
  timeoutMs = 180_000,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', [...COMPOSE, ...args], {
    cwd: REPO_ROOT,
    env: COMPOSE_ENV,
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function krokiHealth(): Promise<string> {
  const { stdout: id } = await compose(['ps', '-q', 'kroki']);
  const containerId = id.trim();
  if (containerId === '') return 'absent';
  const { stdout } = await execFileAsync('docker', [
    'inspect',
    '--format',
    '{{.State.Health.Status}}',
    containerId,
  ]);
  return stdout.trim();
}

export async function waitForKrokiHealthy(timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await krokiHealth().catch(() => 'error');
    if (status === 'healthy') return;
    if (Date.now() > deadline) throw new Error(`Kroki did not become healthy (last status: ${status}).`);
    await new Promise((r) => setTimeout(r, 3_000));
  }
}

/** Build the MCP image and bring Kroki up on the internal network. */
export async function bringUpStack(): Promise<void> {
  await compose(['build', 'mcp']);
  await compose(['up', '-d', 'kroki']);
  await waitForKrokiHealthy();
}

/** Tear the stack down, removing volumes. Safe to call in a finally/afterAll. */
export async function tearDownStack(): Promise<void> {
  await compose(['down', '-v']).catch(() => undefined);
}

/** Whether the given Docker network is `internal: true`. */
export async function isNetworkInternal(networkName: string): Promise<boolean> {
  const { stdout } = await execFileAsync('docker', [
    'network',
    'inspect',
    networkName,
    '--format',
    '{{.Internal}}',
  ]);
  return stdout.trim() === 'true';
}

/** Command + args to launch an ephemeral MCP gateway container with stdio attached. */
export function mcpStdioCommand(): {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
} {
  return {
    command: 'docker',
    args: [...COMPOSE, 'run', '-T', '--rm', 'mcp'],
    cwd: REPO_ROOT,
    env: Object.fromEntries(
      Object.entries(COMPOSE_ENV).filter((e): e is [string, string] => e[1] !== undefined),
    ),
  };
}
