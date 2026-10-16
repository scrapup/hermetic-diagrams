import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GuideCatalog } from '../../guides/guide-catalog.js';
import type { McpToolResult } from './render-diagram.js';
export declare function listAuthoringGuidesResult(catalog: GuideCatalog): McpToolResult;
export declare function getAuthoringGuideResult(catalog: GuideCatalog, id: string): McpToolResult;
export declare function registerAuthoringGuides(server: McpServer, catalog: GuideCatalog): void;
