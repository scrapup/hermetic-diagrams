import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HermeticError } from '../../errors.js';
import type { GuideCatalog } from '../../guides/guide-catalog.js';
import { isGuideId } from '../../guides/guide-ids.js';
import { mapError } from '../error-mapper.js';
import type { McpToolResult } from './render-diagram.js';

/**
 * `list_authoring_guides` / `get_authoring_guide` (aws-icons `plan.md` §4.3–4.4, D-07): shipped,
 * versioned, offline guidance so an AI Requester writes diagrams the PEP accepts on the first try.
 * Served as tools because every target client supports tools uniformly.
 */

function ok(payload: Record<string, unknown>): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
}

export function listAuthoringGuidesResult(catalog: GuideCatalog): McpToolResult {
  return ok({
    awsIconsVersion: catalog.awsIconsVersion,
    guides: [...catalog.guides.values()].map((g) => ({
      id: g.id,
      title: g.title,
      summary: g.summary,
      notation: g.notation,
    })),
  });
}

export function getAuthoringGuideResult(catalog: GuideCatalog, id: string): McpToolResult {
  const guide = isGuideId(id) ? catalog.guides.get(id) : undefined;
  if (guide === undefined) {
    const mapped = mapError(
      new HermeticError(
        'UNKNOWN_GUIDE',
        'No authoring guide with that id. Call list_authoring_guides for the available guides.',
        `available: ${[...catalog.guides.keys()].join(', ')}`,
      ),
    );
    return { content: [{ type: 'text', text: JSON.stringify(mapped) }], structuredContent: { ...mapped }, isError: true };
  }
  return ok({ id: guide.id, title: guide.title, markdown: guide.markdown });
}

export function registerAuthoringGuides(server: McpServer, catalog: GuideCatalog): void {
  server.registerTool(
    'list_authoring_guides',
    {
      title: 'List authoring guides',
      description:
        'List the shipped guides on how to write each supported notation and each kind of AWS diagram ' +
        '(architecture, sequence, C4, simplified, dark). Call this before writing a diagram.',
    },
    () => listAuthoringGuidesResult(catalog),
  );
  server.registerTool(
    'get_authoring_guide',
    {
      title: 'Get an authoring guide',
      description:
        'Return one authoring guide as Markdown: when to use it, building blocks, what this server refuses ' +
        '(and what to use instead) and examples proven to render here.',
      inputSchema: { id: z.string().describe('Guide id, as listed by list_authoring_guides.') },
    },
    (args) => getAuthoringGuideResult(catalog, args.id),
  );
}
