import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IconSet } from '../aws/icon-set-store.js';
import type { GuideCatalog } from '../guides/guide-catalog.js';
import type { HermeticConfig } from '../config.js';
import type { ContainmentReport } from '../containment/types.js';
import type { FetchLike } from '../render/kroki-client.js';
/** Content shipped with the package and verified/loaded at boot. */
export interface ShippedAssets {
    readonly iconSet: IconSet;
    readonly guides: GuideCatalog;
}
/**
 * Assemble the MCP server. `containment_status`, `list_formats`, `list_aws_icons` and the authoring
 * guide tools are always available (discovery never renders); the render tool is registered **only** when containment was proven (fail-closed, `TF-73-03`).
 */
export declare function buildServer(config: HermeticConfig, report: ContainmentReport, assets: ShippedAssets, fetchImpl?: FetchLike): McpServer;
