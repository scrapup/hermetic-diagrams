import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { INPUT_FORMATS, OUTPUT_FORMATS } from '../../domain.js';
import type { McpToolResult } from './render-diagram.js';

/** `list_formats` (`plan.md` §4.2): the supported input notations and output formats. */
export function listFormatsResult(): McpToolResult {
  const payload = { input: [...INPUT_FORMATS], output: [...OUTPUT_FORMATS] };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

export function registerListFormats(server: McpServer): void {
  server.registerTool(
    'list_formats',
    {
      title: 'List supported formats',
      description: 'List the input notations and output image formats this MVP supports.',
    },
    () => listFormatsResult(),
  );
}
