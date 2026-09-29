import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { proveContainment } from './containment/boot-gate.js';
import { buildServer } from './server/build-server.js';
/**
 * MCP Gateway entrypoint (runs inside the `mcp` container over stdio). Boot sequence:
 *   1. Prove containment (Kroki health → egress self-check → canary).
 *   2. Build the server, registering the render tool only if contained (fail-closed).
 *   3. Serve over stdio.
 *
 * stdout is the JSON-RPC channel; all diagnostics go to stderr via the logger.
 */
async function main() {
    const config = loadConfig();
    const report = await proveContainment(config);
    const server = buildServer(config, report);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('server.connected', { contained: report.contained });
}
main().catch((err) => {
    logger.error('server.fatal', { message: err instanceof Error ? err.message : 'unknown' });
    process.exitCode = 1;
});
