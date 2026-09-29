import { describe, it, expect } from 'vitest';
import { scanSecurity } from './security-scanner.js';
import { HermeticError } from '../errors.js';
import type { DiagramFormat } from '../domain.js';

const MAX = 256 * 1024;

function expectReject(format: DiagramFormat, source: string, code = 'EXTERNAL_REFERENCE'): void {
  try {
    scanSecurity(format, source, MAX);
  } catch (err) {
    expect(err).toBeInstanceOf(HermeticError);
    expect((err as HermeticError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${format} source to be rejected: ${source}`);
}

describe('scanSecurity — size limit', () => {
  it('rejects a source over the byte limit with TOO_LARGE', () => {
    try {
      scanSecurity('plantuml', 'A'.repeat(11), 10);
    } catch (err) {
      expect((err as HermeticError).code).toBe('TOO_LARGE');
    }
    expect(() => scanSecurity('plantuml', 'A'.repeat(10), 10)).not.toThrow();
    expect(() => scanSecurity('plantuml', 'A -> B', MAX)).not.toThrow();
  });

  it('measures bytes, not code points (multi-byte char over a small limit)', () => {
    // "é" is 2 bytes in UTF-8; 6 chars = 12 bytes > 10.
    expect(() => scanSecurity('plantuml', 'éééééé', 10)).toThrow(HermeticError);
  });
});

describe('scanSecurity — PlantUML / C4 vectors', () => {
  it('blocks !includeurl', () => expectReject('plantuml', '@startuml\n!includeurl https://evil.test/x\n@enduml'));
  it('blocks !include with a URL', () => expectReject('plantuml', '!include https://evil.test/a.iuml'));
  it('blocks !includesub with a URL', () => expectReject('c4', '!includesub https://evil.test/a!SUB'));
  it('blocks remote !theme', () => expectReject('plantuml', '!theme mytheme from https://evil.test'));
  it('blocks remote sprite <img:url>', () => expectReject('plantuml', 'card x <img:https://evil.test/s.png>'));
  it('blocks %getenv', () => expectReject('plantuml', 'note over A: %getenv("SECRET")'));
  it('blocks c4 remote include via the same rules', () =>
    expectReject('c4', '!include https://evil.test/C4.puml'));
  it('accepts a clean PlantUML source', () => {
    expect(() => scanSecurity('plantuml', '@startuml\nAlice -> Bob: hi\n@enduml', MAX)).not.toThrow();
  });
});

describe('scanSecurity — D2 vectors', () => {
  it('blocks a remote @import', () => expectReject('d2', 'x: @https://evil.test/lib.d2'));
  it('blocks icon: https://', () => expectReject('d2', 'server: { icon: https://evil.test/i.png }'));
  it('accepts a clean D2 source', () => {
    expect(() => scanSecurity('d2', 'a -> b: request', MAX)).not.toThrow();
  });
});

describe('scanSecurity — GraphViz vectors', () => {
  it('blocks image= URL', () => expectReject('graphviz', 'digraph { a [image="https://evil.test/x.png"] }'));
  it('blocks imagepath= URL', () => expectReject('graphviz', 'digraph { imagepath="https://evil.test" }'));
  it('accepts a clean GraphViz source', () => {
    expect(() => scanSecurity('graphviz', 'digraph { a -> b }', MAX)).not.toThrow();
  });
});

describe('scanSecurity — Vega / Vega-Lite vectors', () => {
  it('blocks data.url', () =>
    expectReject('vega-lite', JSON.stringify({ data: { url: 'https://evil.test/data.json' } })));
  it('blocks any url property even without a scheme', () =>
    expectReject('vega', JSON.stringify({ data: { url: 'relative/data.json' } })));
  it('blocks a nested http string value', () =>
    expectReject('vega', JSON.stringify({ config: { background: 'http://evil.test/bg' } })));
  it('accepts a clean inline-data Vega-Lite spec', () => {
    const spec = JSON.stringify({
      mark: 'bar',
      data: { values: [{ a: 1 }, { a: 2 }] },
      encoding: { x: { field: 'a', type: 'quantitative' } },
    });
    expect(() => scanSecurity('vega-lite', spec, MAX)).not.toThrow();
  });
  it('allows the $schema metadata URL (not a fetch vector)', () => {
    const spec = JSON.stringify({
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      mark: 'bar',
      data: { values: [{ a: 1 }] },
    });
    expect(() => scanSecurity('vega-lite', spec, MAX)).not.toThrow();
  });
  it('falls back to a scheme scan when the JSON is malformed', () =>
    expectReject('vega', '{ not valid json https://evil.test/x }'));
});

describe('scanSecurity — DBML / ERD vectors', () => {
  it('blocks a URL reference in DBML', () => expectReject('dbml', '// see https://evil.test/schema'));
  it('blocks a URL reference in ERD', () => expectReject('erd', 'title {label: "https://evil.test"}'));
  it('accepts a clean DBML source', () => {
    expect(() => scanSecurity('dbml', 'Table users { id int }', MAX)).not.toThrow();
  });
});

describe('scanSecurity — XXE across notations', () => {
  it('blocks a DOCTYPE declaration', () =>
    expectReject('graphviz', '<!DOCTYPE foo [ <!ENTITY x SYSTEM "file:///etc/passwd"> ]>'));
  it('blocks a bare ENTITY declaration', () => expectReject('plantuml', '<!ENTITY xxe SYSTEM "http://evil.test">'));
});
