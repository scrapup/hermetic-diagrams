import { describe, it, expect } from 'vitest';
import { renderDiagram, type RenderPipelineDeps } from './render-pipeline.js';
import { loadConfig } from '../config.js';
import { ConcurrencyGuard } from './concurrency.js';
import type { FetchLike } from './kroki-client.js';
import type { HermeticError } from '../errors.js';

function makeDeps(overrides: { maxSourceBytes?: number } = {}): {
  deps: RenderPipelineDeps;
  fetchCalls: () => number;
} {
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls++;
    return new Response('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', { status: 200 });
  };
  const config = { ...loadConfig(), ...overrides };
  return { deps: { config, guard: new ConcurrencyGuard(2), fetchImpl }, fetchCalls: () => calls };
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
});
