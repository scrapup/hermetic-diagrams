import { z } from 'zod';
import { INPUT_FORMATS, OUTPUT_FORMATS } from '../../domain.js';
import { renderDiagram } from '../../render/render-pipeline.js';
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
export function createRenderDiagramHandler(deps) {
    return async (args) => {
        try {
            const outcome = await renderDiagram({ format: args.format, source: args.source, output: args.output }, deps);
            const content = outcome.format === 'svg'
                ? [{ type: 'text', text: outcome.data }]
                : [{ type: 'image', data: outcome.data, mimeType: outcome.mimeType }];
            // structuredContent carries metadata only; the payload lives in `content` (avoids doubling
            // a large PNG over stdio).
            return {
                content,
                structuredContent: {
                    format: outcome.format,
                    mimeType: outcome.mimeType,
                    encoding: outcome.encoding,
                },
            };
        }
        catch (err) {
            const mapped = mapError(err);
            return {
                content: [{ type: 'text', text: JSON.stringify(mapped) }],
                structuredContent: { ...mapped },
                isError: true,
            };
        }
    };
}
export function registerRenderDiagram(server, deps) {
    const handler = createRenderDiagramHandler(deps);
    server.registerTool('render_diagram', {
        title: 'Render a diagram (hermetic)',
        description: 'Render a diagram from text to SVG (default) or PNG entirely inside a no-egress environment. ' +
            'Rejects any external reference before rendering; the source never leaves the machine.',
        inputSchema: RENDER_DIAGRAM_INPUT,
    }, async (args) => handler(args));
}
