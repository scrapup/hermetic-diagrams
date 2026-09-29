import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HermeticConfig } from '../config.js';
import type { ContainmentReport } from '../containment/types.js';
import type { FetchLike } from '../render/kroki-client.js';
/**
 * Assemble the MCP server. `containment_status` and `list_formats` are always available; the
 * render tool is registered **only** when containment was proven (fail-closed, `TF-73-03`).
 */
export declare function buildServer(config: HermeticConfig, report: ContainmentReport, fetchImpl?: FetchLike): McpServer;
