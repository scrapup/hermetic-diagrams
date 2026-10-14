import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { awsIconsStatus, type IconSet } from '../../aws/icon-set-store.js';
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
export function containmentStatusResult(report: ContainmentReport, iconSet: IconSet): McpToolResult {
  const status = { ...report, awsIcons: awsIconsStatus(iconSet) };
  return {
    content: [{ type: 'text', text: JSON.stringify(status) }],
    structuredContent: status,
  };
}

export function registerContainmentStatus(server: McpServer, report: ContainmentReport, iconSet: IconSet): void {
  server.registerTool(
    'containment_status',
    {
      title: 'Report containment status',
      description:
        'Report the boot-time containment proof: egress self-check, canary, SAFE_MODE, ports, and the AWS icon-set integrity.',
    },
    () => containmentStatusResult(report, iconSet),
  );
}
