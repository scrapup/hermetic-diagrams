import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AddressInfo } from 'node:net';
import { bringUpStack, tearDownStack, compose, mcpStdioCommand } from '../helpers/compose.js';

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
    ...awsVectors(base).map((v) => ({ type: 'plantuml', source: v.source })),
  ];
}

/**
 * AWS icon vectors (aws-icons TF-106-04): upstream's documented by-address form rewritten to the
 * sink, the reserved name redefined to the sink, and an escape attempt through the reserved prefix.
 * Each must be refused by the PEP **and** never reach the sink when sent straight to the engine.
 */
function awsVectors(base: string): Array<{ name: string; source: string; code: string }> {
  return [
    {
      name: 'upstream by-address include',
      source: `@startuml\n!include ${base}/awslabs/aws-icons-for-plantuml/v23.1/dist/AWSCommon.puml\n@enduml`,
      code: 'EXTERNAL_REFERENCE',
    },
    {
      name: 'AWSPuml redefined to the sink',
      source: `@startuml\n!define AWSPuml ${base}/awspuml\n!include AWSPuml/AWSCommon.puml\n@enduml`,
      code: 'EXTERNAL_REFERENCE',
    },
    {
      name: 'AWSPuml/../ escape',
      source: `@startuml\n!include AWSPuml/../../${base.replace('http://', '')}/escape.puml\n@enduml`,
      code: 'UNKNOWN_REFERENCE',
    },
  ];
}

let sink: SinkServer;
let client: Client | undefined;

beforeAll(async () => {
  await bringUpStack();
  sink = await startSink();
}, 300_000);

afterAll(async () => {
  await client?.close().catch(() => undefined);
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

describe('golden exfiltration — AWS vectors through the MCP (aws-icons TF-106-04)', () => {
  it('refuses every AWS vector at the PEP and the sink is never reached', async () => {
    client = new Client({ name: 'hermetic-diagrams-golden', version: '0.0.0' });
    await client.connect(new StdioClientTransport(mcpStdioCommand()));
    const base = `http://host.docker.internal:${sink.port}`;

    for (const vector of awsVectors(base)) {
      const res = (await client.callTool({
        name: 'render_diagram',
        arguments: { format: 'plantuml', source: vector.source },
      })) as { isError?: boolean; structuredContent?: Record<string, unknown> };
      expect(res.isError, vector.name).toBe(true);
      expect(res.structuredContent, vector.name).toMatchObject({ error: { code: vector.code } });
    }

    await new Promise((r) => setTimeout(r, 1_500));
    expect(sink.hits).toEqual([]);
  }, 180_000);
});
