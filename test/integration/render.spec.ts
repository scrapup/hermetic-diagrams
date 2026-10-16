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

interface AwsFixture {
  readonly name: string;
  readonly format: 'plantuml' | 'c4';
  readonly source: string;
}

/**
 * Builds an AWS diagram: `head` lines first (e.g. `!$AWS_DARK = true`, a bundled C4 include), then
 * `!include AWSPuml/<path>.puml` for each of `includes` (in order), then the body.
 */
function aws(name: string, includes: readonly string[], body: string, options: { format?: 'c4'; head?: string } = {}): AwsFixture {
  const lines = [
    '@startuml',
    ...(options.head === undefined ? [] : [options.head]),
    ...includes.map((path) => `!include AWSPuml/${path}.puml`),
    body,
    '@enduml',
  ];
  return { name, format: options.format ?? 'plantuml', source: lines.join('\n') };
}

/** AWS diagrams through the MCP (aws-icons TF-106-04): includes resolved from the shipped set. */
const AWS_FIXTURES: readonly AwsFixture[] = [
  aws(
    'every group with an icon (engine shim, D-11)',
    ['AWSCommon', 'Groups/AWSCloud', 'Groups/AWSAccount', 'Groups/Region', 'Groups/VPC', 'Groups/PrivateSubnet', 'Groups/AutoScalingGroup'],
    'AWSCloudGroup(cloud) {\nAWSAccountGroup(acct, "Production") {\nRegionGroup(region, "eu-west-1") {\nVPCGroup(vpc) {\n' +
      'PrivateSubnetGroup(subnet, "Private") {\nAutoScalingGroupGroup(asg) {\n}\n}\n}\n}\n}\n}',
  ),
  aws(
    'experimental icon notes (engine shim, D-11)',
    ['AWSCommon', 'AWSExperimental', 'Compute/Lambda'],
    'participant A\nparticipant B\nA -> B : <$Callout_1> call\n$AWSIconRight("Lambda", "Handler")',
  ),
  aws(
    'architecture with groups',
    ['AWSCommon', 'Groups/AWSCloud', 'Groups/VPC', 'Groups/PublicSubnet', 'Compute/Lambda', 'Storage/SimpleStorageService'],
    'AWSCloudGroup(cloud) {\nVPCGroup(vpc) {\nPublicSubnetGroup(subnet, "Public subnet") {\nLambda(fn, "Handler", "Node.js 24")\n}\n}\n' +
      'SimpleStorageService(bucket, "Assets", "S3")\n}\nfn --> bucket',
  ),
  aws(
    'sequence with participants',
    ['AWSCommon', 'Compute/Lambda', 'Database/DynamoDB'],
    'actor User as u\nLambdaParticipant(fn, "Handler", "Node.js 24")\nDynamoDBParticipant(db, "Orders", "table")\n' +
      'u -> fn : invoke\nfn -> db : PutItem',
  ),
  aws(
    'c4 with AWSC4Integration',
    ['AWSC4Integration', 'AWSCommon', 'Compute/Lambda', 'Database/DynamoDB'],
    'Person(user, "User")\nContainer(fn, "Handler", "Lambda", "Serves requests", $sprite="Lambda")\n' +
      'ContainerDb(table, "Orders", "DynamoDB", "Stores orders", $sprite="DynamoDB")\nRel(user, fn, "Calls")\nRel(fn, table, "Reads/writes")',
    { format: 'c4', head: '!include <C4/C4_Container>' },
  ),
  aws('dark mode', ['AWSCommon', 'Compute/Lambda'], 'Lambda(fn, "Handler", "Node.js 24")', { head: '!$AWS_DARK = true' }),
  aws(
    'simplified style',
    ['AWSCommon', 'AWSSimplified', 'Compute/Lambda', 'Storage/SimpleStorageService'],
    'Lambda(fn, "Handler", "")\nSimpleStorageService(bucket, "Assets", "")\nfn --> bucket',
  ),
  aws(
    'category all.puml',
    ['AWSCommon', 'Storage/all'],
    'SimpleStorageService(bucket, "Assets", "S3")\nBackup(bk, "Backups", "AWS Backup")\nbucket --> bk',
  ),
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
    const res = await callRender({ format: 'plantuml', source: AWS_FIXTURES.find((f) => f.name === 'architecture with groups')!.source, output: 'svg' });
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
