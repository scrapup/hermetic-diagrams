import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * TF-79-05 (T-25..T-29): the plugin's `.mcp.json` launches the pinned npm package through one
 * `node -e` launcher that works on Windows, macOS and Linux, and its pin tracks package.json.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');

interface ServerConfig {
  command: string;
  args: string[];
}
const raw = read('.mcp.json');
const server = (JSON.parse(raw) as { mcpServers: Record<string, ServerConfig> }).mcpServers[
  'hermetic-diagrams'
]!;
const pkg = JSON.parse(read('package.json')) as { name: string; version: string };
const [flag, launcher, pinned] = server.args;

type Listener = (arg: number | null) => void;

/** Evaluate the launcher with stubbed `require` and `process`, as `node -e <launcher> <pinned>`. */
function runLauncher(platform: NodeJS.Platform): {
  spawn: ReturnType<typeof vi.fn>;
  exit: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  child: Record<string, Listener>;
  signals: Record<string, () => void>;
} {
  const child: Record<string, Listener> = {};
  const kill = vi.fn();
  const spawn = vi.fn(() => ({
    on: (event: string, cb: Listener) => {
      child[event] = cb;
    },
    kill,
  }));
  const exit = vi.fn();
  const signals: Record<string, () => void> = {};
  const fakeProcess = {
    platform,
    argv: ['node', pinned],
    exit,
    on: (signal: string, cb: () => void) => {
      signals[signal] = cb;
    },
  };
  const fakeRequire = (id: string): unknown => {
    if (id !== 'node:child_process') throw new Error(`unexpected require ${id}`);
    return { spawn };
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('require', 'process', launcher!) as (r: unknown, p: unknown) => void;
  run(fakeRequire, fakeProcess);
  return { spawn, exit, kill, child, signals };
}

describe('.mcp.json', () => {
  it('runs node -e with the launcher and the version as the only extra argument', () => {
    expect(server.command).toBe('node');
    expect(server.args).toHaveLength(3);
    expect(flag).toBe('-e');
  });

  it('pins exactly the package.json version (T-25)', () => {
    expect(pinned).toBe(pkg.version);
  });

  it('pins an exact semver, never a range or tag (T-25)', () => {
    expect(pinned).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });

  it('never uses the plugin-cache path or a bare npx command (T-29)', () => {
    expect(raw).not.toContain('CLAUDE_PLUGIN_ROOT');
    expect(server.command).not.toBe('npx');
  });
});

describe('launcher (T-26, T-27)', () => {
  const spec = `${pkg.name}@${pkg.version}`;

  it('spawns npx without a shell on macOS/Linux', () => {
    const { spawn } = runLauncher('linux');

    expect(spawn).toHaveBeenCalledWith('npx', ['--prefer-offline', '-y', spec], { stdio: 'inherit' });
  });

  it('spawns npx.cmd through the shell on Windows, with constant args and the pinned spec', () => {
    const { spawn } = runLauncher('win32');

    expect(spawn).toHaveBeenCalledWith(`npx.cmd --prefer-offline -y ${spec}`, {
      stdio: 'inherit',
      shell: true,
    });
  });

  it('propagates the child exit code', () => {
    const { child, exit } = runLauncher('darwin');

    child.exit!(3);

    expect(exit).toHaveBeenCalledWith(3);
  });

  it('exits 1 when the child is killed by a signal', () => {
    const { child, exit } = runLauncher('linux');

    child.exit!(null);

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 127 when npx cannot be spawned', () => {
    const { child, exit } = runLauncher('linux');

    child.error!(null);

    expect(exit).toHaveBeenCalledWith(127);
  });

  it.each(['SIGINT', 'SIGTERM'])('forwards %s to the child', (signal) => {
    const { signals, kill } = runLauncher('linux');

    signals[signal]!();

    expect(kill).toHaveBeenCalledWith(signal);
  });
});

describe('release-please (T-28)', () => {
  it('bumps the .mcp.json pin on every release', () => {
    const config = JSON.parse(read('release-please-config.json')) as {
      packages: Record<string, { 'extra-files': { type: string; path: string; jsonpath: string }[] }>;
    };

    expect(config.packages['.']!['extra-files']).toContainEqual({
      type: 'json',
      path: '.mcp.json',
      jsonpath: "$.mcpServers['hermetic-diagrams'].args[2]",
    });
  });
});
