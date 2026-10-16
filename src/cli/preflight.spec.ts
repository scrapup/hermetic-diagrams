import { describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from './docker-runner.js';
import {
  COMPOSE_PROBE_MS,
  IMAGE_INSPECT_PROBE_MS,
  IMAGES_LIST_PROBE_MS,
  PREFLIGHT_BUDGET_MS,
  RUNTIME_PROBE_MS,
  checkCompose,
  checkImages,
  checkRuntime,
  compareVersions,
  parseComposeVersion,
  runPreflight,
  type Capture,
} from './preflight.js';

const result = (code: number, stdout = '', timedOut = false): CaptureResult => ({
  code,
  stdout,
  timedOut,
});

function captureOf(...results: CaptureResult[]): Capture & ReturnType<typeof vi.fn> {
  const fn = vi.fn<Capture>();
  for (const r of results) fn.mockResolvedValueOnce(r);
  return fn;
}

const COMPOSE = ['compose', '-f', 'compose.yaml'];
const HINT = 'run: npx @scrapup/hermetic-diagrams@1.2.3 up';

describe('preflight budget', () => {
  it('keeps the sum of all probe time boxes at or under 60 s', () => {
    expect(PREFLIGHT_BUDGET_MS).toBe(
      RUNTIME_PROBE_MS + COMPOSE_PROBE_MS + IMAGES_LIST_PROBE_MS + IMAGE_INSPECT_PROBE_MS,
    );
    expect(PREFLIGHT_BUDGET_MS).toBeLessThanOrEqual(60_000);
  });
});

describe('checkRuntime', () => {
  it('passes when Docker answers with Linux containers', async () => {
    const capture = captureOf(result(0, 'linux\n'));

    expect(await checkRuntime(capture)).toEqual({ ok: true });
    expect(capture).toHaveBeenCalledWith(['info', '--format', '{{.OSType}}'], RUNTIME_PROBE_MS);
  });

  it('fails with a start-Docker hint when docker info exits non-zero', async () => {
    const r = await checkRuntime(captureOf(result(1)));

    expect(r).toEqual({ ok: false, reason: expect.stringContaining('Docker is not reachable') as string });
  });

  it('fails with a start-Docker hint when docker is not installed (127)', async () => {
    const r = await checkRuntime(captureOf(result(127)));

    expect(r.ok).toBe(false);
  });

  it('fails when the probe times out', async () => {
    const r = await checkRuntime(captureOf(result(124, '', true)));

    expect(r).toEqual({ ok: false, reason: expect.stringContaining('did not answer in time') as string });
  });

  it('fails with a Linux-containers hint in Windows containers mode', async () => {
    const r = await checkRuntime(captureOf(result(0, 'windows\n')));

    expect(r).toEqual({ ok: false, reason: expect.stringContaining('switch Docker Desktop to Linux containers') as string });
  });
});

describe('checkCompose', () => {
  it('passes on a recent Compose', async () => {
    const capture = captureOf(result(0, '2.29.1\n'));

    expect(await checkCompose(capture)).toEqual({ ok: true });
    expect(capture).toHaveBeenCalledWith(['compose', 'version', '--short'], COMPOSE_PROBE_MS);
  });

  it('passes on exactly the minimum version', async () => {
    expect(await checkCompose(captureOf(result(0, 'v2.24.0')))).toEqual({ ok: true });
  });

  it('fails naming the found version when Compose is too old', async () => {
    const r = await checkCompose(captureOf(result(0, '2.23.9')));

    expect(r).toEqual({ ok: false, reason: expect.stringContaining('found 2.23.9') as string });
  });

  it('fails when docker compose is not available', async () => {
    const r = await checkCompose(captureOf(result(1)));

    expect(r).toEqual({ ok: false, reason: expect.stringContaining('not available') as string });
  });

  it('fails when the probe times out', async () => {
    expect((await checkCompose(captureOf(result(124, '', true)))).ok).toBe(false);
  });

  it('fails when the version cannot be parsed', async () => {
    const r = await checkCompose(captureOf(result(0, 'unknown')));

    expect(r).toEqual({ ok: false, reason: expect.stringContaining('could not read') as string });
  });
});

describe('checkImages', () => {
  const IMAGES = 'yuzutech/kroki@sha256:abc\nhermetic-diagrams-mcp:1.2.3\n';

  it('passes when every resolved image exists locally', async () => {
    const capture = captureOf(result(0, IMAGES), result(0, 'sha256:1\nsha256:2\n'));

    expect(await checkImages(capture, COMPOSE, [], HINT)).toEqual({ ok: true });
    expect(capture).toHaveBeenNthCalledWith(1, [...COMPOSE, 'config', '--images'], IMAGES_LIST_PROBE_MS);
    expect(capture).toHaveBeenNthCalledWith(
      2,
      ['image', 'inspect', '--format', '{{.Id}}', 'yuzutech/kroki@sha256:abc', 'hermetic-diagrams-mcp:1.2.3'],
      IMAGE_INSPECT_PROBE_MS,
    );
  });

  it('also inspects required images that config --images does not list (profiled MCP gateway)', async () => {
    const capture = captureOf(result(0, 'yuzutech/kroki@sha256:abc\n'), result(0));

    await checkImages(capture, COMPOSE, ['hermetic-diagrams-mcp:1.2.3'], HINT);

    expect(capture.mock.calls[1]?.[0]).toEqual([
      'image', 'inspect', '--format', '{{.Id}}', 'yuzutech/kroki@sha256:abc', 'hermetic-diagrams-mcp:1.2.3',
    ]);
  });

  it('does not inspect an image twice when it is both listed and required', async () => {
    const capture = captureOf(result(0, 'a:1\nmcp:1\n'), result(0));

    await checkImages(capture, COMPOSE, ['mcp:1'], HINT);

    expect(capture.mock.calls[1]?.[0]).toEqual(['image', 'inspect', '--format', '{{.Id}}', 'a:1', 'mcp:1']);
  });

  it('parses CRLF output (Windows)', async () => {
    const capture = captureOf(result(0, 'a:1\r\nb:2\r\n'), result(0));

    await checkImages(capture, COMPOSE, [], HINT);

    expect(capture.mock.calls[1]?.[0]).toEqual(['image', 'inspect', '--format', '{{.Id}}', 'a:1', 'b:2']);
  });

  it('fails with the up hint when an image is missing', async () => {
    const r = await checkImages(captureOf(result(0, IMAGES), result(1)), COMPOSE, [], HINT);

    expect(r).toEqual({ ok: false, reason: `this version is not prepared — ${HINT}` });
  });

  it('fails with the up hint when inspect times out', async () => {
    const r = await checkImages(captureOf(result(0, IMAGES), result(124, '', true)), COMPOSE, [], HINT);

    expect(r.ok).toBe(false);
  });

  it('fails when the image list cannot be resolved', async () => {
    const capture = captureOf(result(1));

    const r = await checkImages(capture, COMPOSE, [], HINT);

    expect(r).toEqual({ ok: false, reason: `could not resolve the images of this version — ${HINT}` });
    expect(capture).toHaveBeenCalledOnce();
  });

  it('fails when the image list is empty', async () => {
    expect((await checkImages(captureOf(result(0, '\n')), COMPOSE, [], HINT)).ok).toBe(false);
  });

  it('fails when listing times out', async () => {
    expect((await checkImages(captureOf(result(124, '', true)), COMPOSE, [], HINT)).ok).toBe(false);
  });
});

describe('runPreflight', () => {
  it('passes when every probe passes', async () => {
    const r = await runPreflight([async () => ({ ok: true }), async () => ({ ok: true })]);

    expect(r).toEqual({ ok: true });
  });

  it('stops at the first failing probe', async () => {
    const third = vi.fn(async () => ({ ok: true }) as const);

    const r = await runPreflight([
      async () => ({ ok: true }),
      async () => ({ ok: false, reason: 'second' }),
      third,
    ]);

    expect(r).toEqual({ ok: false, reason: 'second' });
    expect(third).not.toHaveBeenCalled();
  });
});

describe('parseComposeVersion / compareVersions', () => {
  it.each([
    ['2.29.1', '2.29.1'],
    ['v2.29.1', '2.29.1'],
    ['2.29.1-desktop.1', '2.29.1'],
    ['5.3.1\n', '5.3.1'],
  ])('parses %j as %s', (raw, expected) => {
    expect(parseComposeVersion(raw)).toBe(expected);
  });

  it('returns undefined for unparsable output', () => {
    expect(parseComposeVersion('dev')).toBeUndefined();
  });

  it('parses a long digit run without a version in linear time', () => {
    const start = performance.now();
    expect(parseComposeVersion('1'.repeat(50_000))).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(100);
  });

  it.each([
    ['2.24.0', '2.24.0', 0],
    ['2.24.1', '2.24.0', 1],
    ['2.9.0', '2.24.0', -1],
    ['10.0.0', '2.24.0', 1],
    ['2.24', '2.24.0', 0],
    ['2.24.0', '2.24', 0],
  ])('compares %s with %s', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
  });
});
