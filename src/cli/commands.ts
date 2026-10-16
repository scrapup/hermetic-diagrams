import type { Capture, PreflightResult } from './preflight.js';
import { checkCompose, checkImages, checkRuntime, runPreflight } from './preflight.js';
import { imageRef, upCommand } from './version.js';

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
export const KROKI_WAIT_S = 180;

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

export const EXIT_PREFLIGHT = 1;

function reportFailure(ctx: CliContext, result: PreflightResult): number {
  if (!result.ok) ctx.log(result.reason);
  return EXIT_PREFLIGHT;
}

async function step(ctx: CliContext, label: string, args: readonly string[]): Promise<number> {
  ctx.log(`${label}…`);
  const code = await ctx.docker([...ctx.composeArgs, ...args], 'setup');
  if (code !== 0) ctx.log(`${label} failed (exit ${code}).`);
  return code;
}

/** One-time preparation: preflight → pull Kroki → build MCP image → start Kroki and wait healthy. */
export async function up(ctx: CliContext): Promise<number> {
  const pre = await runPreflight([() => checkRuntime(ctx.capture), () => checkCompose(ctx.capture)]);
  if (!pre.ok) return reportFailure(ctx, pre);
  if (!ctx.distPresent()) {
    ctx.log('dist/ is missing — this looks like a source checkout; run `npm run build` first.');
    return EXIT_PREFLIGHT;
  }

  const steps: readonly [string, readonly string[]][] = [
    ['pulling the pinned Kroki image', ['pull', 'kroki']],
    [`building the MCP image for ${ctx.version}`, ['build', 'mcp']],
    [
      'starting Kroki and waiting until it is healthy',
      ['up', '-d', '--wait', '--wait-timeout', String(KROKI_WAIT_S), 'kroki'],
    ],
  ];
  for (const [label, args] of steps) {
    const code = await step(ctx, label, args);
    if (code !== 0) return code;
  }
  ctx.log(`version ${ctx.version} is ready.`);
  return 0;
}

/** Per-session start: preflight (incl. images) → ensure Kroki → attach stdio to the gateway. */
export async function serve(ctx: CliContext): Promise<number> {
  const hint = `run: ${upCommand(ctx.version)}`;
  const pre = await runPreflight([
    () => checkRuntime(ctx.capture),
    () => checkCompose(ctx.capture),
    () => checkImages(ctx.capture, ctx.composeArgs, [imageRef(ctx.version)], hint),
  ]);
  if (!pre.ok) return reportFailure(ctx, pre);

  const kroki = await ctx.docker(
    [
      ...ctx.composeArgs,
      'up', '-d', '--wait', '--wait-timeout', String(KROKI_WAIT_S),
      '--pull', 'never', '--no-build', 'kroki',
    ],
    'setup',
  );
  if (kroki !== 0) {
    ctx.log(`Kroki did not start (exit ${kroki}) — ${hint}`);
    return kroki;
  }
  return ctx.docker([...ctx.composeArgs, 'run', '-T', '--rm', '--pull', 'never', 'mcp'], 'attach');
}
