import { describe, it, expect, vi } from 'vitest';
import { renderDiagram, type RenderPipelineDeps } from './render-pipeline.js';
import { loadConfig } from '../config.js';
import { ConcurrencyGuard } from './concurrency.js';
import type { FetchLike } from './kroki-client.js';
import type { HermeticError } from '../errors.js';
import type { IconSet } from '../aws/icon-set-store.js';
import { UNVERIFIED_ICON_SET, verifiedIconSet } from '../../test/helpers/icon-sets.js';

function makeDeps(
  overrides: { maxSourceBytes?: number; maxExpandedSourceBytes?: number } = {},
  iconSet: IconSet = UNVERIFIED_ICON_SET,
): {
  deps: RenderPipelineDeps;
  fetchCalls: () => number;
  bodies: () => string[];
} {
  let calls = 0;
  const bodies: string[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    calls++;
    bodies.push(typeof init.body === 'string' ? init.body : '');
    return new Response('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', { status: 200 });
  };
  const config = { ...loadConfig(), ...overrides };
  return { deps: { config, guard: new ConcurrencyGuard(2), iconSet, fetchImpl }, fetchCalls: () => calls, bodies: () => bodies };
}

async function codeOf(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    return (err as HermeticError).code;
  }
  return undefined;
}

describe('renderDiagram — PEP ordering (never calls Kroki on a rejected request)', () => {
  it('rejects an unknown format with INVALID_FORMAT before any render', async () => {
    const { deps, fetchCalls } = makeDeps();
    expect(await codeOf(() => renderDiagram({ format: 'nope', source: 'x' }, deps))).toBe('INVALID_FORMAT');
    expect(fetchCalls()).toBe(0);
  });

  it('rejects a non-string source with EMPTY_CONTENT', async () => {
    const { deps, fetchCalls } = makeDeps();
    expect(await codeOf(() => renderDiagram({ format: 'plantuml', source: 123 }, deps))).toBe('EMPTY_CONTENT');
    expect(fetchCalls()).toBe(0);
  });

  it('enforces the size limit FIRST — an oversized source never reaches syntax/security/Kroki', async () => {
    const { deps, fetchCalls } = makeDeps({ maxSourceBytes: 16 });
    // Oversized AND syntactically broken AND with an external ref: TOO_LARGE must win, no fetch.
    const bad = '@startuml\n!includeurl https://evil.test/x\n'.repeat(10);
    expect(await codeOf(() => renderDiagram({ format: 'plantuml', source: bad }, deps))).toBe('TOO_LARGE');
    expect(fetchCalls()).toBe(0);
  });

  it('rejects an external reference with EXTERNAL_REFERENCE before render', async () => {
    const { deps, fetchCalls } = makeDeps();
    const code = await codeOf(() =>
      renderDiagram({ format: 'plantuml', source: '@startuml\n!includeurl https://evil.test/x\n@enduml' }, deps),
    );
    expect(code).toBe('EXTERNAL_REFERENCE');
    expect(fetchCalls()).toBe(0);
  });
});

describe('renderDiagram — happy path', () => {
  it('renders a valid source to sanitized SVG and calls Kroki once', async () => {
    const { deps, fetchCalls } = makeDeps();
    const outcome = await renderDiagram({ format: 'plantuml', source: '@startuml\nA->B\n@enduml' }, deps);
    expect(outcome).toMatchObject({ format: 'svg', mimeType: 'image/svg+xml', encoding: 'utf8' });
    expect(outcome.data).toMatch(/<svg/);
    expect(fetchCalls()).toBe(1);
  });

  it('renders PNG as base64 (raster branch, no sanitization)', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const config = loadConfig();
    const deps: RenderPipelineDeps = {
      config,
      guard: new ConcurrencyGuard(2),
      iconSet: UNVERIFIED_ICON_SET,
      fetchImpl: async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }),
    };
    const outcome = await renderDiagram({ format: 'graphviz', source: 'digraph { a -> b }', output: 'png' }, deps);
    expect(outcome).toMatchObject({ format: 'png', mimeType: 'image/png', encoding: 'base64' });
    expect(Buffer.from(outcome.data, 'base64')).toEqual(Buffer.from(png));
  });
});

describe('renderDiagram — engine error propagation', () => {
  function depsWith(status: number): RenderPipelineDeps {
    return {
      config: loadConfig(),
      guard: new ConcurrencyGuard(2),
      iconSet: UNVERIFIED_ICON_SET,
      fetchImpl: async () => new Response('engine says no', { status }),
    };
  }

  it('propagates a Kroki 4xx as INVALID_SYNTAX', async () => {
    expect(await codeOf(() => renderDiagram({ format: 'graphviz', source: 'digraph { a -> b }' }, depsWith(400)))).toBe(
      'INVALID_SYNTAX',
    );
  });

  it('propagates a Kroki 5xx as RENDER_ERROR', async () => {
    expect(await codeOf(() => renderDiagram({ format: 'graphviz', source: 'digraph { a -> b }' }, depsWith(503)))).toBe(
      'RENDER_ERROR',
    );
  });
});

describe('renderDiagram — AWS includes (aws-icons TF-106-03)', () => {
  const SET = verifiedIconSet({
    'AWSCommon.puml': '!define AWSEntity(a) rectangle a',
    'Compute/Lambda.puml': 'sprite $Lambda [1x1/16z] {\nx\n}',
  });

  it('sends the expanded, self-contained source to Kroki', async () => {
    const { deps, bodies } = makeDeps({}, SET);
    await renderDiagram(
      {
        format: 'plantuml',
        source: '@startuml\n!include AWSPuml/AWSCommon.puml\n!include AWSPuml/Compute/Lambda.puml\nAWSEntity(x)\n@enduml',
      },
      deps,
    );
    expect(bodies()).toEqual([
      '@startuml\n!define AWSEntity(a) rectangle a\nsprite $Lambda [1x1/16z] {\nx\n}\nAWSEntity(x)\n@enduml',
    ]);
  });

  it('still refuses an external reference that arrives through expansion (scanner runs on the expanded source)', async () => {
    const poisoned = verifiedIconSet({ 'AWSCommon.puml': '!includeurl https://sink.example/x.puml' });
    const { deps, fetchCalls } = makeDeps({}, poisoned);
    const code = await codeOf(() =>
      renderDiagram({ format: 'plantuml', source: '@startuml\n!include AWSPuml/AWSCommon.puml\n@enduml' }, deps),
    );
    expect(code).toBe('EXTERNAL_REFERENCE');
    expect(fetchCalls()).toBe(0);
  });

  it('refuses an AWSPuml redefinition before Kroki', async () => {
    const { deps, fetchCalls } = makeDeps({}, SET);
    const code = await codeOf(() =>
      renderDiagram({ format: 'plantuml', source: '@startuml\n!define AWSPuml http://sink/\n@enduml' }, deps),
    );
    expect(code).toBe('EXTERNAL_REFERENCE');
    expect(fetchCalls()).toBe(0);
  });

  it('applies the expanded limit to the expanded source', async () => {
    const { deps, fetchCalls } = makeDeps({ maxSourceBytes: 100, maxExpandedSourceBytes: 120 }, verifiedIconSet({ 'AWSCommon.puml': 'x'.repeat(200) }));
    const code = await codeOf(() =>
      renderDiagram({ format: 'plantuml', source: '@startuml\n!include AWSPuml/AWSCommon.puml\n@enduml' }, deps),
    );
    expect(code).toBe('TOO_LARGE');
    expect(fetchCalls()).toBe(0);
  });

  it('refuses AWS includes with ICONS_UNAVAILABLE when the set is unverified', async () => {
    const { deps, fetchCalls } = makeDeps();
    const code = await codeOf(() =>
      renderDiagram({ format: 'plantuml', source: '@startuml\n!include AWSPuml/AWSCommon.puml\n@enduml' }, deps),
    );
    expect(code).toBe('ICONS_UNAVAILABLE');
    expect(fetchCalls()).toBe(0);
  });

  it('sends a non-AWS source unchanged', async () => {
    const { deps, bodies } = makeDeps({}, SET);
    const source = '@startuml\nAlice -> Bob\n@enduml';
    await renderDiagram({ format: 'plantuml', source }, deps);
    expect(bodies()).toEqual([source]);
  });

  it('logs aws.resolve with counts only when AWS includes were inlined', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { deps } = makeDeps({}, SET);
    await renderDiagram({ format: 'plantuml', source: '@startuml\nAlice -> Bob\n@enduml' }, deps);
    await renderDiagram(
      { format: 'plantuml', source: '@startuml\n!include AWSPuml/AWSCommon.puml\n!include AWSPuml/Compute/Lambda.puml\n@enduml' },
      deps,
    );
    const lines = write.mock.calls.map((c) => String(c[0]));
    write.mockRestore();
    const resolves = lines.filter((l) => l.includes('"event":"aws.resolve"'));
    expect(resolves).toHaveLength(1);
    const event = JSON.parse(resolves[0] ?? '{}') as Record<string, unknown>;
    expect(Object.keys(event).sort()).toEqual(['durationMs', 'event', 'expandedBytes', 'includes', 'level']);
    expect(event.includes).toBe(2);
    expect(lines.join('')).not.toMatch(/Lambda|AWSCommon/);
  });
});
