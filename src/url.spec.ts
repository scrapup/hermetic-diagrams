import { describe, it, expect } from 'vitest';
import { stripTrailingSlashes } from './url.js';

describe('stripTrailingSlashes', () => {
  it.each([
    ['', ''],
    ['/', ''],
    ['http://kroki:8000', 'http://kroki:8000'],
    ['http://kroki:8000/', 'http://kroki:8000'],
    ['http://kroki:8000///', 'http://kroki:8000'],
    ['a/b', 'a/b'],
  ])('maps %j to %j', (input, expected) => {
    expect(stripTrailingSlashes(input)).toBe(expected);
  });

  it('handles a long run of inner slashes in linear time', () => {
    const start = performance.now();
    expect(stripTrailingSlashes(`${'/'.repeat(50_000)}x`)).toBe(
      `${'/'.repeat(50_000)}x`,
    );
    expect(performance.now() - start).toBeLessThan(100);
  });
});
