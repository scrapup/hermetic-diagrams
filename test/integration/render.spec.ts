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

describe('containment_status — AWS icon set (aws-icons TF-106-04)', () => {
  it('reports the shipped icon set as verified', async () => {
    const res = (await client.callTool({ name: 'containment_status', arguments: {} })) as unknown as ToolCallResult;
    expect(res.structuredContent).toMatchObject({ awsIcons: { state: 'verified', version: 'v23.1' } });
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

/** Text of the image PlantUML draws instead of the diagram when it crashes. */
const ENGINE_CRASH = /An error has occurred|has crashed/;

/** AWS diagrams through the MCP (aws-icons TF-106-04): includes resolved from the shipped set. */
const AWS_FIXTURES: ReadonlyArray<{ readonly name: string; readonly format: 'plantuml' | 'c4'; readonly source: string }> = [
  {
    name: 'every group with an icon (engine shim, D-11)',
    format: 'plantuml',
    source: [
      '@startuml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/Groups/AWSCloud.puml',
      '!include AWSPuml/Groups/AWSAccount.puml',
      '!include AWSPuml/Groups/Region.puml',
      '!include AWSPuml/Groups/VPC.puml',
      '!include AWSPuml/Groups/PrivateSubnet.puml',
      '!include AWSPuml/Groups/AutoScalingGroup.puml',
      'AWSCloudGroup(cloud) {',
      '  AWSAccountGroup(acct, "Production") {',
      '    RegionGroup(region, "eu-west-1") {',
      '      VPCGroup(vpc) {',
      '        PrivateSubnetGroup(subnet, "Private") {',
      '          AutoScalingGroupGroup(asg) {',
      '          }',
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'experimental icon notes (engine shim, D-11)',
    format: 'plantuml',
    source: [
      '@startuml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/AWSExperimental.puml',
      '!include AWSPuml/Compute/Lambda.puml',
      'participant A',
      'participant B',
      'A -> B : <$Callout_1> call',
      '$AWSIconRight("Lambda", "Handler")',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'architecture with groups',
    format: 'plantuml',
    source: [
      '@startuml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/Groups/AWSCloud.puml',
      '!include AWSPuml/Groups/VPC.puml',
      '!include AWSPuml/Groups/PublicSubnet.puml',
      '!include AWSPuml/Compute/Lambda.puml',
      '!include AWSPuml/Storage/SimpleStorageService.puml',
      'AWSCloudGroup(cloud) {',
      '  VPCGroup(vpc) {',
      '    PublicSubnetGroup(subnet, "Public subnet") {',
      '      Lambda(fn, "Handler", "Node.js 24")',
      '    }',
      '  }',
      '  SimpleStorageService(bucket, "Assets", "S3")',
      '}',
      'fn --> bucket',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'sequence with participants',
    format: 'plantuml',
    source: [
      '@startuml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/Compute/Lambda.puml',
      '!include AWSPuml/Database/DynamoDB.puml',
      'actor User as u',
      'LambdaParticipant(fn, "Handler", "Node.js 24")',
      'DynamoDBParticipant(db, "Orders", "table")',
      'u -> fn : invoke',
      'fn -> db : PutItem',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'c4 with AWSC4Integration',
    format: 'c4',
    source: [
      '@startuml',
      '!include <C4/C4_Container>',
      '!include AWSPuml/AWSC4Integration.puml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/Compute/Lambda.puml',
      '!include AWSPuml/Database/DynamoDB.puml',
      'Person(user, "User")',
      'Container(fn, "Handler", "Lambda", "Serves requests", $sprite="Lambda")',
      'ContainerDb(table, "Orders", "DynamoDB", "Stores orders", $sprite="DynamoDB")',
      'Rel(user, fn, "Calls")',
      'Rel(fn, table, "Reads/writes")',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'dark mode',
    format: 'plantuml',
    source: [
      '@startuml',
      '!$AWS_DARK = true',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/Compute/Lambda.puml',
      'Lambda(fn, "Handler", "Node.js 24")',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'simplified style',
    format: 'plantuml',
    source: [
      '@startuml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/AWSSimplified.puml',
      '!include AWSPuml/Compute/Lambda.puml',
      '!include AWSPuml/Storage/SimpleStorageService.puml',
      'Lambda(fn, "Handler", "")',
      'SimpleStorageService(bucket, "Assets", "")',
      'fn --> bucket',
      '@enduml',
    ].join('\n'),
  },
  {
    name: 'category all.puml',
    format: 'plantuml',
    source: [
      '@startuml',
      '!include AWSPuml/AWSCommon.puml',
      '!include AWSPuml/Storage/all.puml',
      'SimpleStorageService(bucket, "Assets", "S3")',
      'Backup(bk, "Backups", "AWS Backup")',
      'bucket --> bk',
      '@enduml',
    ].join('\n'),
  },
];

describe('render_diagram — AWS icons (aws-icons TF-106-04)', () => {
  for (const fx of AWS_FIXTURES) {
    it(`renders ${fx.name} to sanitized SVG`, async () => {
      const res = await callRender({ format: fx.format, source: fx.source, output: 'svg' });
      expect(res.isError, res.content[0]?.text).toBeFalsy();
      const svg = res.content[0]?.text ?? '';
      expect(svg).toMatch(/<svg/i);
      expect(svg).not.toMatch(/<script/i);
      // The engine answers HTTP 200 with a stack-trace image when PlantUML crashes (aws-icons D-11).
      expect(svg).not.toMatch(ENGINE_CRASH);
    });

    it(`renders ${fx.name} to PNG`, async () => {
      const res = await callRender({ format: fx.format, source: fx.source, output: 'png' });
      expect(res.isError, res.content[0]?.text).toBeFalsy();
      expect((res.content[0]?.data ?? '').length).toBeGreaterThan(0);
    });
  }

  it('keeps the embedded icon images in the sanitized SVG', async () => {
    const res = await callRender({ format: 'plantuml', source: AWS_FIXTURES[0]!.source, output: 'svg' });
    expect(res.content[0]?.text ?? '').toContain('data:image/png');
  });

  it.each([
    ['!include AWSPuml/AWSCommon.puml\n!include AWSPuml/Compute/Lambdda.puml', 'UNKNOWN_REFERENCE'],
    ['!include AWSPuml/../AWSCommon.puml', 'UNKNOWN_REFERENCE'],
    ['!define AWSPuml https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/v23.1/dist', 'EXTERNAL_REFERENCE'],
    ['!include AWSPuml/Compute/Lambda.puml\n!include AWSPuml/AWSCommon.puml', 'INVALID_SYNTAX'],
  ])('refuses %j with %s before rendering', async (body, code) => {
    const res = await callRender({ format: 'plantuml', source: `@startuml\n${body}\n@enduml` });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({ error: { code } });
  });
});
