import { describe, it, expect } from 'vitest';
import { canaryRender, buildCanarySource, CANARY_TOKEN } from './canary-render.js';

const NEVER_HIT = (): boolean => false;
const WAS_HIT = (): boolean => true;

describe('canaryRender', () => {
  it('builds a source that embeds a remote include', () => {
    expect(buildCanarySource('http://sink.test/x')).toContain('!includeurl http://sink.test/x');
  });

  it('fails when the sink was reached', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => '<svg>ok</svg>',
      wasSinkHit: WAS_HIT,
    });
    expect(result.pass).toBe(false);
  });

  it('fails when the token leaks into the output (even if sink flag is false)', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => `<svg>${CANARY_TOKEN}</svg>`,
      wasSinkHit: NEVER_HIT,
    });
    expect(result.pass).toBe(false);
  });

  it('passes when the sink is cold and no token appears', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => '<svg>ok</svg>',
      wasSinkHit: NEVER_HIT,
    });
    expect(result.pass).toBe(true);
  });

  it('passes when the render is refused/errors and the sink is cold', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => null,
      wasSinkHit: NEVER_HIT,
    });
    expect(result.pass).toBe(true);
  });

  it('passes when renderRaw throws and the sink is cold', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => {
        throw new Error('blocked');
      },
      wasSinkHit: NEVER_HIT,
    });
    expect(result.pass).toBe(true);
  });
});
