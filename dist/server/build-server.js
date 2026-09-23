import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { ConcurrencyGuard } from '../render/concurrency.js';
import { registerContainmentStatus } from './tools/containment-status.js';
import { registerListFormats } from './tools/list-formats.js';
import { registerRenderDiagram } from './tools/render-diagram.js';
/**
 * Assemble the MCP server. `containment_status` and `list_formats` are always available; the
 * render tool is registered **only** when containment was proven (fail-closed, `TF-73-03`).
 */
export function buildServer(config, report, fetchImpl) {
    const server = new McpServer({
        name: 'hermetic-diagrams',
        version: '0.1.0',
    });
    registerContainmentStatus(server, report);
    registerListFormats(server);
    if (report.contained) {
        const guard = new ConcurrencyGuard(config.maxConcurrency);
        registerRenderDiagram(server, { config, guard, ...(fetchImpl ? { fetchImpl } : {}) });
        logger.info('server.ready', { renderEnabled: true });
    }
    else {
        // Fail-closed: `NOT_CONTAINED` is realized by NOT registering the render tool at all (a stronger
        // guarantee than returning the error per call). The `NOT_CONTAINED` state is observable via the
        // always-registered `containment_status` tool.
        logger.warn('server.degraded', { renderEnabled: false, reason: 'NOT_CONTAINED' });
    }
    return server;
}
