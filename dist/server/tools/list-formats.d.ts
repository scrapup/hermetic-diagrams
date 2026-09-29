import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpToolResult } from './render-diagram.js';
/** `list_formats` (`plan.md` §4.2): the supported input notations and output formats. */
export declare function listFormatsResult(): McpToolResult;
export declare function registerListFormats(server: McpServer): void;
