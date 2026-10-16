import { describe, it, expect, vi } from 'vitest';
import { mapError } from './error-mapper.js';
import { HermeticError } from '../errors.js';

describe('mapError', () => {
  it('maps a rejection HermeticError, preserving code and detail', () => {
    const mapped = mapError(new HermeticError('EXTERNAL_REFERENCE', 'nope', 'remote include'));
    expect(mapped.error).toEqual({ code: 'EXTERNAL_REFERENCE', message: 'nope', detail: 'remote include' });
  });

  it.each(['UNKNOWN_REFERENCE', 'ICONS_UNAVAILABLE', 'UNKNOWN_GUIDE'] as const)(
    'maps %s as a request rejection, logging the code only',
    (code) => {
      const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const mapped = mapError(new HermeticError(code, 'refused', 'Compute/Lambdda.puml'));
      expect(mapped.error).toEqual({ code, message: 'refused', detail: 'Compute/Lambdda.puml' });
      const logged = write.mock.calls.map((c) => String(c[0])).join('');
      write.mockRestore();
      expect(logged).toContain('"event":"request.rejected"');
      expect(logged).toContain(`"code":"${code}"`);
      expect(logged).not.toContain('Lambdda');
    },
  );

  it('omits detail when absent', () => {
    const mapped = mapError(new HermeticError('EMPTY_CONTENT', 'empty'));
    expect(mapped.error).toEqual({ code: 'EMPTY_CONTENT', message: 'empty' });
    expect('detail' in mapped.error).toBe(false);
  });

  it('maps an engine HermeticError (RENDER_TIMEOUT)', () => {
    const mapped = mapError(new HermeticError('RENDER_TIMEOUT', 'too slow'));
    expect(mapped.error.code).toBe('RENDER_TIMEOUT');
  });

  it('collapses an unknown error to a generic RENDER_ERROR (no leak)', () => {
    const mapped = mapError(new Error('stack with /secret/path'));
    expect(mapped.error.code).toBe('RENDER_ERROR');
    expect(mapped.error.message).not.toMatch(/secret/);
  });

  it('handles a non-Error thrown value', () => {
    const mapped = mapError('boom');
    expect(mapped.error.code).toBe('RENDER_ERROR');
  });
});
