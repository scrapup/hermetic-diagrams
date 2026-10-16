import { describe, it, expect } from 'vitest';
import { canaryRender, buildCanarySource, CANARY_TOKEN, type CanaryDeps } from './canary-render.js';

const TRUE = (): boolean => true;
const FALSE = (): boolean => false;

function deps(overrides: Partial<CanaryDeps>): CanaryDeps {
  return {
    canaryUrl: 'http://sink.test/canary',
    renderRaw: async () => '<svg>ok</svg>',
    wasSinkHit: FALSE,
    sinkReachable: TRUE,
    ...overrides,
  };
}

describe('canaryRender', () => {
  it('builds a source that embeds a remote include', () => {
    expect(buildCanarySource('http://sink.test/x')).toContain('!includeurl http://sink.test/x');
  });

  it('fails when the sink was reached (real leak)', async () => {
    const result = await canaryRender(deps({ wasSinkHit: TRUE }));
    expect(result.pass).toBe(false);
  });

  it('fails when the token leaks into the output', async () => {
    const result = await canaryRender(deps({ renderRaw: async () => `<svg>${CANARY_TOKEN}</svg>` }));
    expect(result.pass).toBe(false);
  });

  it('fails closed when the sink is not reachable (cannot prove containment)', async () => {
    const result = await canaryRender(deps({ sinkReachable: FALSE }));
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/not reachable/i);
  });

  it('passes when the sink is reachable, cold, and no token appears', async () => {
    expect((await canaryRender(deps({}))).pass).toBe(true);
  });

  it('passes when the render is refused/errors and the sink is cold', async () => {
    expect((await canaryRender(deps({ renderRaw: async () => null }))).pass).toBe(true);
  });

  it('passes when renderRaw throws and the sink is cold', async () => {
    const result = await canaryRender(
      deps({
        renderRaw: async () => {
          throw new Error('blocked');
        },
      }),
    );
    expect(result.pass).toBe(true);
  });
});
