import { describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from './docker-runner.js';
import { EXIT_PREFLIGHT, KROKI_WAIT_S, serve, up, type CliContext, type StdioMode } from './commands.js';

const VERSION = '1.2.3';
const COMPOSE = ['compose', '-f', '/pkg/compose.yaml'];
const FIX_IT = `run: npx @scrapup/hermetic-diagrams@${VERSION} up`;

const ok = (stdout = ''): CaptureResult => ({ code: 0, stdout, timedOut: false });
const bad = (code = 1): CaptureResult => ({ code, stdout: '', timedOut: false });

/** Probe answers keyed by the docker args prefix, so tests read like the real sequence. */
function captureFrom(answers: {
  info?: CaptureResult;
  compose?: CaptureResult;
  images?: CaptureResult;
  inspect?: CaptureResult;
}): (args: readonly string[]) => Promise<CaptureResult> {
  return async (args) => {
    if (args[0] === 'info') return answers.info ?? ok('linux');
    if (args[1] === 'version') return answers.compose ?? ok('2.29.1');
    if (args.includes('config')) return answers.images ?? ok('kroki@sha256:x\nmcp:1.2.3\n');
    return answers.inspect ?? ok('sha256:1\nsha256:2');
  };
}

function makeContext(overrides: {
  capture?: CliContext['capture'];
  dockerCodes?: number[];
  distPresent?: boolean;
} = {}): { ctx: CliContext; dockerCalls: [readonly string[], StdioMode][]; lines: string[] } {
  const dockerCalls: [readonly string[], StdioMode][] = [];
  const lines: string[] = [];
  const codes = [...(overrides.dockerCodes ?? [])];
  const ctx: CliContext = {
    version: VERSION,
    composeArgs: COMPOSE,
    docker: vi.fn(async (args: readonly string[], mode: StdioMode) => {
      dockerCalls.push([args, mode]);
      return codes.shift() ?? 0;
    }),
    capture: overrides.capture ?? captureFrom({}),
    log: (line) => lines.push(line),
    distPresent: () => overrides.distPresent ?? true,
  };
  return { ctx, dockerCalls, lines };
}

const argsOf = (calls: [readonly string[], StdioMode][]): string[][] =>
  calls.map(([a]) => a.slice(COMPOSE.length));

describe('up', () => {
  it('pulls Kroki, builds the MCP image, then starts Kroki and waits healthy', async () => {
    const { ctx, dockerCalls, lines } = makeContext();

    const code = await up(ctx);

    expect(code).toBe(0);
    expect(argsOf(dockerCalls)).toEqual([
      ['pull', 'kroki'],
      ['build', 'mcp'],
      ['up', '-d', '--wait', '--wait-timeout', String(KROKI_WAIT_S), 'kroki'],
    ]);
    expect(dockerCalls.every(([a, mode]) => mode === 'setup' && a[0] === 'compose')).toBe(true);
    expect(lines.at(-1)).toBe(`version ${VERSION} is ready.`);
  });

  it('stops at the first failing step, names it and returns its exit code', async () => {
    const { ctx, dockerCalls, lines } = makeContext({ dockerCodes: [0, 17] });

    const code = await up(ctx);

    expect(code).toBe(17);
    expect(argsOf(dockerCalls)).toEqual([['pull', 'kroki'], ['build', 'mcp']]);
    expect(lines).toContain(`building the MCP image for ${VERSION} failed (exit 17).`);
  });

  it('fails the health wait with its exit code', async () => {
    const { ctx } = makeContext({ dockerCodes: [0, 0, 1] });

    expect(await up(ctx)).toBe(1);
  });

  it('fails before any docker step when Docker is not reachable', async () => {
    const { ctx, dockerCalls, lines } = makeContext({ capture: captureFrom({ info: bad() }) });

    const code = await up(ctx);

    expect(code).toBe(EXIT_PREFLIGHT);
    expect(dockerCalls).toHaveLength(0);
    expect(lines[0]).toContain('Docker is not reachable');
  });

  it('fails before any docker step when Compose is too old', async () => {
    const { ctx, dockerCalls } = makeContext({ capture: captureFrom({ compose: ok('2.0.0') }) });

    expect(await up(ctx)).toBe(EXIT_PREFLIGHT);
    expect(dockerCalls).toHaveLength(0);
  });

  it('fails with a build-first message when dist/ is missing (source checkout)', async () => {
    const { ctx, dockerCalls, lines } = makeContext({ distPresent: false });

    expect(await up(ctx)).toBe(EXIT_PREFLIGHT);
    expect(dockerCalls).toHaveLength(0);
    expect(lines[0]).toContain('npm run build');
  });

  it('does not check local images (up is the step that creates them)', async () => {
    const capture = vi.fn(captureFrom({}));
    const { ctx } = makeContext({ capture });

    await up(ctx);

    expect(capture.mock.calls.some(([a]) => a.includes('config') || a.includes('inspect'))).toBe(false);
  });
});

describe('serve', () => {
  it('inspects the MCP image of its own version even though compose does not list it', async () => {
    const capture = vi.fn(captureFrom({ images: ok('kroki@sha256:x\n') }));
    const { ctx } = makeContext({ capture });

    await serve(ctx);

    const inspect = capture.mock.calls.find(([a]) => a[0] === 'image');
    expect(inspect?.[0]).toContain(`hermetic-diagrams-mcp:${VERSION}`);
  });

  it('starts Kroki without pull/build, then attaches stdio to the gateway', async () => {
    const { ctx, dockerCalls } = makeContext();

    const code = await serve(ctx);

    expect(code).toBe(0);
    expect(argsOf(dockerCalls)).toEqual([
      ['up', '-d', '--wait', '--wait-timeout', String(KROKI_WAIT_S), '--pull', 'never', '--no-build', 'kroki'],
      ['run', '-T', '--rm', '--pull', 'never', 'mcp'],
    ]);
    expect(dockerCalls.map(([, mode]) => mode)).toEqual(['setup', 'attach']);
  });

  it('never pulls or builds: every call carries --pull never and no build/pull subcommand', async () => {
    const { ctx, dockerCalls } = makeContext();

    await serve(ctx);

    for (const [args] of dockerCalls) {
      const sub = args[COMPOSE.length];
      expect(['pull', 'build']).not.toContain(sub);
      expect(args).not.toContain('--build');
      expect(args.join(' ')).toContain('--pull never');
    }
  });

  it('returns the gateway exit code', async () => {
    const { ctx } = makeContext({ dockerCodes: [0, 5] });

    expect(await serve(ctx)).toBe(5);
  });

  it('fails fast with the exact up command when the MCP image is missing', async () => {
    const { ctx, dockerCalls, lines } = makeContext({ capture: captureFrom({ inspect: bad() }) });

    const code = await serve(ctx);

    expect(code).toBe(EXIT_PREFLIGHT);
    expect(dockerCalls).toHaveLength(0);
    expect(lines).toEqual([`this version is not prepared — ${FIX_IT}`]);
  });

  it('fails fast with the up command when the images cannot be resolved', async () => {
    const { ctx, dockerCalls, lines } = makeContext({ capture: captureFrom({ images: bad() }) });

    expect(await serve(ctx)).toBe(EXIT_PREFLIGHT);
    expect(dockerCalls).toHaveLength(0);
    expect(lines[0]).toContain(FIX_IT);
  });

  it('fails fast naming Linux containers mode', async () => {
    const { ctx, lines } = makeContext({ capture: captureFrom({ info: ok('windows') }) });

    expect(await serve(ctx)).toBe(EXIT_PREFLIGHT);
    expect(lines[0]).toContain('Linux containers');
  });

  it('reports Kroki start failure with the up hint and does not attach', async () => {
    const { ctx, dockerCalls, lines } = makeContext({ dockerCodes: [1] });

    expect(await serve(ctx)).toBe(1);
    expect(dockerCalls).toHaveLength(1);
    expect(lines[0]).toBe(`Kroki did not start (exit 1) — ${FIX_IT}`);
  });
});
