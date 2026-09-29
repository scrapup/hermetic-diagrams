import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  bringUpStack,
  tearDownStack,
  mcpStdioCommand,
  compose,
  isNetworkInternal,
} from '../helpers/compose.js';

/**
 * Integration (TF-76-05 / plan §7.1): bring up the real compose stack on the `internal: true`
 * network and exercise it end-to-end through the MCP over stdio against the real Kroki. Asserts
 * sanitized output, containment, and that an external reference is refused. Always torn down.
 */

interface Fixture {
  readonly format: string;
  readonly source: string;
  readonly png: boolean; // whether the Kroki core image can rasterize this notation to PNG
}

const FIXTURES: readonly Fixture[] = [
  { format: 'plantuml', source: '@startuml\nAlice -> Bob: hi\n@enduml', png: true },
  { format: 'c4', source: '@startuml\n!include <C4/C4_Context>\nPerson(u, "User")\n@enduml', png: true },
  { format: 'd2', source: 'a -> b: request', png: false },
  { format: 'graphviz', source: 'digraph { a -> b }', png: true },
  { format: 'dbml', source: 'Table users { id int }', png: false },
  { format: 'erd', source: '[Person]\n*name', png: true },
  {
    format: 'vega',
    source: JSON.stringify({ $schema: 'https://vega.github.io/schema/vega/v5.json', width: 100, height: 100, marks: [] }),
    png: false,
  },
  {
    format: 'vega-lite',
    source: JSON.stringify({
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      mark: 'bar',
      data: { values: [{ a: 1 }] },
      encoding: { x: { field: 'a', type: 'quantitative' } },
    }),
    png: false,
  },
];

let client: Client;

interface ToolCallResult {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
}

async function callRender(args: { format: string; source: string; output?: 'svg' | 'png' }): Promise<ToolCallResult> {
  return (await client.callTool({ name: 'render_diagram', arguments: args })) as unknown as ToolCallResult;
}

beforeAll(async () => {
  await bringUpStack();
  client = new Client({ name: 'hermetic-diagrams-it', version: '0.0.0' });
  await client.connect(new StdioClientTransport(mcpStdioCommand()));
}, 300_000);

afterAll(async () => {
  await client?.close().catch(() => undefined);
  await tearDownStack();
});

describe('containment topology', () => {
  it('runs on an internal network with no published port', async () => {
    const { stdout: net } = await compose(['ps', '--format', '{{.Publishers}}']);
    // No `0.0.0.0:host->container` mapping should appear.
    expect(net).not.toMatch(/0\.0\.0\.0:/);

    expect(await isNetworkInternal('hermetic-diagrams_hermetic')).toBe(true);
  });
});

describe('containment_status tool', () => {
  it('reports contained with the egress and canary gates passing', async () => {
    const res = (await client.callTool({ name: 'containment_status', arguments: {} })) as unknown as ToolCallResult;
    expect(res.structuredContent).toMatchObject({
      contained: true,
      checks: { egressSelfCheck: 'pass', canaryRender: 'pass', krokiSafeMode: 'SECURE' },
    });
  });
});

describe('list_formats tool', () => {
  it('lists the eight input notations', async () => {
    const res = (await client.callTool({ name: 'list_formats', arguments: {} })) as unknown as ToolCallResult;
    expect((res.structuredContent?.['input'] as string[]).length).toBe(8);
  });
});

describe('render_diagram — SVG (all notations)', () => {
  for (const fx of FIXTURES) {
    it(`renders ${fx.format} to sanitized SVG`, async () => {
      const res = await callRender({ format: fx.format, source: fx.source, output: 'svg' });
      expect(res.isError).toBeFalsy();
      expect(res.structuredContent).toMatchObject({ format: 'svg', mimeType: 'image/svg+xml' });
      const svg = res.content[0]?.text ?? '';
      expect(svg).toMatch(/<svg/i);
      expect(svg).not.toMatch(/<script/i);
    });
  }
});

describe('render_diagram — PNG (core-capable notations)', () => {
  for (const fx of FIXTURES.filter((f) => f.png)) {
    it(`renders ${fx.format} to PNG`, async () => {
      const res = await callRender({ format: fx.format, source: fx.source, output: 'png' });
      expect(res.isError).toBeFalsy();
      expect(res.structuredContent).toMatchObject({ format: 'png', encoding: 'base64' });
      expect((res.content[0]?.data ?? '').length).toBeGreaterThan(0);
    });
  }
});

describe('render_diagram — refuses external references', () => {
  it('rejects a PlantUML remote include with EXTERNAL_REFERENCE', async () => {
    const res = await callRender({
      format: 'plantuml',
      source: '@startuml\n!includeurl https://evil.test/x\n@enduml',
    });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({ error: { code: 'EXTERNAL_REFERENCE' } });
  });
});
