import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type IconSet } from '../../aws/icon-set-store.js';
import type { ContainmentReport } from '../../containment/types.js';
import type { McpToolResult } from './render-diagram.js';
/**
 * `containment_status` (`plan.md` §4.3): expose the boot-gate results so an operator can inspect
 * whether the environment is contained. Always registered, even when not contained — so a failed
 * gate is observable rather than silent.
 *
 * `awsIcons` (`plan.md` §4.7) reports the icon-set integrity separately: it never affects
 * `contained` — a bad set only disables the AWS feature (D-06).
 */
export declare function containmentStatusResult(report: ContainmentReport, iconSet: IconSet): McpToolResult;
export declare function registerContainmentStatus(server: McpServer, report: ContainmentReport, iconSet: IconSet): void;
