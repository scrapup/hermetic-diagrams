import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractExamples } from '../../src/guides/guide-examples.js';
import { GUIDE_IDS } from '../../src/guides/guide-ids.js';
import { REPO_ROOT, bringUpStack, mcpStdioCommand, tearDownStack } from '../helpers/compose.js';

/**
 * aws-icons TF-108-04 (RN-14): every `hermetic-example` in every shipped guide renders through the
 * MCP against the real contained stack — the same path a Requester uses. A guide example that stops
 * rendering after an engine or icon-set update blocks the update.
 */

interface ToolCallResult {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string; data?: string }>;
}

const cases = GUIDE_IDS.flatMap((id) =>
  extractExamples(readFileSync(path.join(REPO_ROOT, 'assets', 'guides', `${id}.md`), 'utf8')).map((example) => ({
    name: `${id}.md:${example.line} (${example.format} → ${example.output})`,
    example,
  })),
);

let client: Client;

beforeAll(async () => {
  await bringUpStack();
  client = new Client({ name: 'hermetic-diagrams-guides-it', version: '0.0.0' });
  await client.connect(new StdioClientTransport(mcpStdioCommand()));
}, 300_000);

afterAll(async () => {
  await client?.close().catch(() => undefined);
  await tearDownStack();
});

describe('authoring guides — the tools serve every guide', () => {
  it('lists all guides with the icon-set version', async () => {
    const res = (await client.callTool({ name: 'list_authoring_guides', arguments: {} })) as unknown as ToolCallResult;
    expect(res.structuredContent?.['awsIconsVersion']).toBe('v23.1');
    expect((res.structuredContent?.['guides'] as unknown[]).length).toBe(GUIDE_IDS.length);
  });
});

/** Text of the image PlantUML draws instead of the diagram when it crashes (HTTP 200, aws-icons D-11). */
const ENGINE_CRASH = /An error has occurred|has crashed/;

async function render(format: string, source: string, output: string): Promise<ToolCallResult> {
  return (await client.callTool({ name: 'render_diagram', arguments: { format, source, output } })) as unknown as ToolCallResult;
}

describe('authoring guides — every example renders', () => {
  it.each(cases)('$name', async ({ example }) => {
    const res = await render(example.format, example.source, example.output);
    expect(res.isError, res.content[0]?.text).toBeFalsy();
    const payload = example.output === 'svg' ? res.content[0]?.text : res.content[0]?.data;
    expect((payload ?? '').length).toBeGreaterThan(0);

    // A crashed render is still HTTP 200; its SVG form carries the crash text, so check it too.
    const svg = example.output === 'svg' ? res : await render(example.format, example.source, 'svg');
    expect(svg.content[0]?.text ?? '').not.toMatch(ENGINE_CRASH);
  });
});
