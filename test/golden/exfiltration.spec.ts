import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { bringUpStack, tearDownStack, compose } from '../helpers/compose.js';

/**
 * Golden exfiltration test (TF-76-02 / plan §7.1): for each notation, a source with an external
 * reference to an **instrumented sink** is sent to the engine — bypassing the PEP on purpose. The
 * suite passes **only if the sink is never reached**, proving containment holds at the network +
 * engine layers (this is the boot canary mechanism, run against the compose stack). A single sink
 * hit is a hard failure and a containment regression.
 */

interface SinkServer {
  readonly port: number;
  readonly hits: string[];
  close(): Promise<void>;
}

async function startSink(): Promise<SinkServer> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '/');
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('SINK');
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Per-notation external-reference vectors that would hit the sink if the engine resolved them. */
function vectors(base: string): Array<{ type: string; source: string }> {
  return [
    { type: 'plantuml', source: `@startuml\n!includeurl ${base}/plantuml\n@enduml` },
    { type: 'c4plantuml', source: `@startuml\n!includeurl ${base}/c4\n@enduml` },
    { type: 'graphviz', source: `digraph { a [image="${base}/graphviz"] }` },
    { type: 'd2', source: `x: { icon: ${base}/d2 }` },
    {
      type: 'vega',
      source: JSON.stringify({
        $schema: 'https://vega.github.io/schema/vega/v5.json',
        data: [{ name: 't', url: `${base}/vega` }],
        marks: [],
      }),
    },
    {
      type: 'vegalite',
      source: JSON.stringify({
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { url: `${base}/vegalite` },
        mark: 'bar',
      }),
    },
  ];
}

let sink: SinkServer;

beforeAll(async () => {
  await bringUpStack();
  sink = await startSink();
}, 300_000);

afterAll(async () => {
  await sink?.close();
  await tearDownStack();
});

describe('golden exfiltration', () => {
  it('never reaches the sink for any notation (bypassing the PEP)', async () => {
    // host.docker.internal maps to the host; on the internal network it must be unreachable.
    const base = `http://host.docker.internal:${sink.port}`;
    const cases = vectors(base);

    // POST each vector straight to Kroki from inside a container on the internal network.
    const program = `
      const cases = ${JSON.stringify(cases)};
      for (const c of cases) {
        try {
          await fetch('http://kroki:8000/' + c.type + '/svg', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: c.source,
          });
        } catch {}
      }
    `;

    await compose(
      ['run', '-T', '--rm', '--entrypoint', 'node', 'mcp', '--input-type=module', '-e', program],
      120_000,
    );

    // Give any late outbound fetch a moment to arrive, then assert zero hits.
    await new Promise((r) => setTimeout(r, 1_500));
    expect(sink.hits).toEqual([]);
  }, 180_000);
});
