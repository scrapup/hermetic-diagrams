import { describe, it, expect } from 'vitest';
import { validateFormat } from './format-validator.js';
import { HermeticError } from '../errors.js';
import { INPUT_FORMATS } from '../domain.js';

describe('validateFormat', () => {
  it('accepts every allowlisted input format', () => {
    for (const format of INPUT_FORMATS) {
      expect(validateFormat({ format })).toEqual({ format, output: 'svg' });
    }
  });

  it('defaults output to svg when omitted', () => {
    expect(validateFormat({ format: 'plantuml' })).toEqual({ format: 'plantuml', output: 'svg' });
  });

  it('accepts png output', () => {
    expect(validateFormat({ format: 'd2', output: 'png' })).toEqual({ format: 'd2', output: 'png' });
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(validateFormat({ format: '  PlantUML ', output: ' SVG ' })).toEqual({
      format: 'plantuml',
      output: 'svg',
    });
  });

  it('rejects a missing format with INVALID_FORMAT', () => {
    expect(() => validateFormat({ format: undefined })).toThrow(HermeticError);
    try {
      validateFormat({ format: '' });
    } catch (err) {
      expect((err as HermeticError).code).toBe('INVALID_FORMAT');
    }
  });

  it('distinguishes an out-of-MVP (deferred) format from an unknown one', () => {
    let deferred: HermeticError | undefined;
    try {
      validateFormat({ format: 'mermaid' });
    } catch (err) {
      deferred = err as HermeticError;
    }
    expect(deferred?.code).toBe('INVALID_FORMAT');
    expect(deferred?.message).toMatch(/MVP cycle/i);

    let unknown: HermeticError | undefined;
    try {
      validateFormat({ format: 'totally-made-up' });
    } catch (err) {
      unknown = err as HermeticError;
    }
    expect(unknown?.code).toBe('INVALID_FORMAT');
    expect(unknown?.message).toMatch(/unknown/i);
  });

  it('rejects an unknown output format', () => {
    try {
      validateFormat({ format: 'plantuml', output: 'pdf' });
    } catch (err) {
      expect((err as HermeticError).code).toBe('INVALID_FORMAT');
      return;
    }
    throw new Error('expected rejection');
  });
});
