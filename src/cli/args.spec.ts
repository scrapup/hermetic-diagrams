import { describe, it, expect } from 'vitest';
import { parseCommand } from './args.js';

describe('parseCommand', () => {
  it('defaults to serve with no args (MCP client invocation)', () => {
    expect(parseCommand([])).toBe('serve');
  });

  it('recognizes each known subcommand', () => {
    expect(parseCommand(['serve'])).toBe('serve');
    expect(parseCommand(['up'])).toBe('up');
    expect(parseCommand(['down'])).toBe('down');
    expect(parseCommand(['pull'])).toBe('pull');
    expect(parseCommand(['help'])).toBe('help');
  });

  it('maps --help/-h to help', () => {
    expect(parseCommand(['--help'])).toBe('help');
    expect(parseCommand(['-h'])).toBe('help');
  });

  it('maps an unknown command to help', () => {
    expect(parseCommand(['frobnicate'])).toBe('help');
  });
});
