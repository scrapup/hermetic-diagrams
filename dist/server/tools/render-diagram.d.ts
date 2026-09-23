import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type RenderPipelineDeps } from '../../render/render-pipeline.js';
/**
 * `render_diagram` (`plan.md` §4.1): the full contained path. Registered **only** when the boot
 * gate proves containment (`TF-73-03`). `format` is accepted as a free string so the PEP produces
 * the contract's `INVALID_FORMAT` error rather than a schema error.
 */
export declare const RENDER_DIAGRAM_INPUT: {
    format: z.ZodString;
    source: z.ZodString;
    output: z.ZodOptional<z.ZodEnum<["svg", "png"]>>;
};
export interface McpToolResult {
    [key: string]: unknown;
    content: Array<{
        type: 'text';
        text: string;
    } | {
        type: 'image';
        data: string;
        mimeType: string;
    }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
}
export interface RenderDiagramArgs {
    format: string;
    source: string;
    output?: 'svg' | 'png' | undefined;
}
export declare function createRenderDiagramHandler(deps: RenderPipelineDeps): (args: RenderDiagramArgs) => Promise<McpToolResult>;
export declare function registerRenderDiagram(server: McpServer, deps: RenderPipelineDeps): void;
