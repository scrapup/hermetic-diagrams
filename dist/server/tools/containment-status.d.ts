import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ContainmentReport } from '../../containment/types.js';
import type { McpToolResult } from './render-diagram.js';
/**
 * `containment_status` (`plan.md` §4.3): expose the boot-gate results so an operator can inspect
 * whether the environment is contained. Always registered, even when not contained — so a failed
 * gate is observable rather than silent.
 */
export declare function containmentStatusResult(report: ContainmentReport): McpToolResult;
export declare function registerContainmentStatus(server: McpServer, report: ContainmentReport): void;
