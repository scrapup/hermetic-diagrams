import { describe, it, expect } from 'vitest';
import { mapError } from './error-mapper.js';
import { HermeticError } from '../errors.js';

describe('mapError', () => {
  it('maps a rejection HermeticError, preserving code and detail', () => {
    const mapped = mapError(new HermeticError('EXTERNAL_REFERENCE', 'nope', 'remote include'));
    expect(mapped.error).toEqual({ code: 'EXTERNAL_REFERENCE', message: 'nope', detail: 'remote include' });
  });

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
