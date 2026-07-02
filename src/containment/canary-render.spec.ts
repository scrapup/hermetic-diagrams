import { describe, it, expect } from 'vitest';
import { canaryRender, buildCanarySource, CANARY_TOKEN } from './canary-render.js';

describe('canaryRender', () => {
  it('builds a source that embeds a remote include', () => {
    const src = buildCanarySource('http://sink.test/x');
    expect(src).toContain('!includeurl http://sink.test/x');
  });

  it('fails (pass=false) when the token leaks into the output', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => `<svg>${CANARY_TOKEN}</svg>`,
    });
    expect(result.pass).toBe(false);
  });

  it('passes when the output does not contain the token', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => '<svg>ok</svg>',
    });
    expect(result.pass).toBe(true);
  });

  it('passes when the render is refused/errors (null output)', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => null,
    });
    expect(result.pass).toBe(true);
  });

  it('passes when renderRaw throws', async () => {
    const result = await canaryRender({
      canaryUrl: 'http://sink.test/x',
      renderRaw: async () => {
        throw new Error('blocked');
      },
    });
    expect(result.pass).toBe(true);
  });
});
