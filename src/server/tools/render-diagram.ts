import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { INPUT_FORMATS, OUTPUT_FORMATS } from '../../domain.js';
import { renderDiagram, type RenderPipelineDeps } from '../../render/render-pipeline.js';
import { mapError } from '../error-mapper.js';

/**
 * `render_diagram` (`plan.md` §4.1): the full contained path. Registered **only** when the boot
 * gate proves containment (`TF-73-03`). `format` is accepted as a free string so the PEP produces
 * the contract's `INVALID_FORMAT` error rather than a schema error.
 */

export const RENDER_DIAGRAM_INPUT = {
  format: z.string().describe(`Diagram notation. One of: ${INPUT_FORMATS.join(', ')}.`),
  source: z.string().describe('The diagram source text.'),
  output: z
    .enum(OUTPUT_FORMATS)
    .optional()
    .describe('Output image format; defaults to svg.'),
};

export interface McpToolResult {
  // Index signature keeps this structurally compatible with the SDK's CallToolResult (_meta, etc.).
  [key: string]: unknown;
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface RenderDiagramArgs {
  format: string;
  source: string;
  output?: 'svg' | 'png' | undefined;
}

export function createRenderDiagramHandler(deps: RenderPipelineDeps) {
  return async (args: RenderDiagramArgs): Promise<McpToolResult> => {
    try {
      const outcome = await renderDiagram(
        { format: args.format, source: args.source, output: args.output },
        deps,
      );

      const content: McpToolResult['content'] =
        outcome.format === 'svg'
          ? [{ type: 'text', text: outcome.data }]
          : [{ type: 'image', data: outcome.data, mimeType: outcome.mimeType }];

      return { content, structuredContent: { ...outcome } };
    } catch (err) {
      const mapped = mapError(err);
      return {
        content: [{ type: 'text', text: JSON.stringify(mapped) }],
        structuredContent: { ...mapped },
        isError: true,
      };
    }
  };
}

export function registerRenderDiagram(server: McpServer, deps: RenderPipelineDeps): void {
  const handler = createRenderDiagramHandler(deps);
  server.registerTool(
    'render_diagram',
    {
      title: 'Render a diagram (hermetic)',
      description:
        'Render a diagram from text to SVG (default) or PNG entirely inside a no-egress environment. ' +
        'Rejects any external reference before rendering; the source never leaves the machine.',
      inputSchema: RENDER_DIAGRAM_INPUT,
    },
    async (args) => handler(args),
  );
}
