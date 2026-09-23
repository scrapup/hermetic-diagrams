import { describe, it, expect } from 'vitest';
import { validateSyntax } from './syntax-validator.js';
import type { HermeticError } from '../errors.js';

function code(fn: () => void): string | undefined {
  try {
    fn();
  } catch (err) {
    return (err as HermeticError).code;
  }
  return undefined;
}

describe('validateSyntax — empty and encoding', () => {
  it('rejects empty content', () => {
    expect(code(() => validateSyntax('plantuml', ''))).toBe('EMPTY_CONTENT');
  });
  it('rejects whitespace-only content', () => {
    expect(code(() => validateSyntax('d2', '   \n\t '))).toBe('EMPTY_CONTENT');
  });
  it('rejects a replacement-char (bad encoding)', () => {
    expect(code(() => validateSyntax('d2', 'a -> b �'))).toBe('INVALID_SYNTAX');
  });
});

describe('validateSyntax — JSON notations', () => {
  it('accepts a well-formed Vega-Lite spec', () => {
    expect(() => validateSyntax('vega-lite', '{"mark":"bar"}')).not.toThrow();
  });
  it('rejects malformed JSON with INVALID_SYNTAX', () => {
    expect(code(() => validateSyntax('vega', '{ not json'))).toBe('INVALID_SYNTAX');
  });
});

describe('validateSyntax — PlantUML', () => {
  it('accepts balanced @start/@end', () => {
    expect(() => validateSyntax('plantuml', '@startuml\nA -> B\n@enduml')).not.toThrow();
  });
  it('accepts content without @start blocks', () => {
    expect(() => validateSyntax('plantuml', 'A -> B: hi')).not.toThrow();
  });
  it('rejects unbalanced @start/@end', () => {
    expect(code(() => validateSyntax('c4', '@startuml\nA -> B'))).toBe('INVALID_SYNTAX');
  });
});

describe('validateSyntax — GraphViz', () => {
  it('accepts a valid digraph', () => {
    expect(() => validateSyntax('graphviz', 'digraph { a -> b }')).not.toThrow();
  });
  it('rejects missing graph declaration', () => {
    expect(code(() => validateSyntax('graphviz', 'a -> b'))).toBe('INVALID_SYNTAX');
  });
  it('rejects unbalanced braces', () => {
    expect(code(() => validateSyntax('graphviz', 'digraph { a -> b'))).toBe('INVALID_SYNTAX');
  });
});

describe('validateSyntax — permissive notations', () => {
  it('accepts non-empty D2 / DBML / ERD without structural checks', () => {
    expect(() => validateSyntax('d2', 'a -> b')).not.toThrow();
    expect(() => validateSyntax('dbml', 'Table t { id int }')).not.toThrow();
    expect(() => validateSyntax('erd', '[Person]\n*name')).not.toThrow();
  });
});
