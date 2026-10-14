import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { bootIconSet } from './aws/icon-set-store.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { proveContainment } from './containment/boot-gate.js';
import { buildServer } from './server/build-server.js';

/**
 * MCP Gateway entrypoint (runs inside the `mcp` container over stdio). Boot sequence:
 *   1. Prove containment (Kroki health → egress self-check → canary).
 *   2. Load and verify the shipped AWS icon set (an unverified set disables AWS includes only).
 *   3. Build the server, registering the render tool only if contained (fail-closed).
 *   4. Serve over stdio.
 *
 * stdout is the JSON-RPC channel; all diagnostics go to stderr via the logger.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const report = await proveContainment(config);
  const iconSet = await bootIconSet(config.awsIconsRoot, config.awsIconsLockPath);
  const server = buildServer(config, report, iconSet);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('server.connected', { contained: report.contained });
}

main().catch((err: unknown) => {
  logger.error('server.fatal', { message: err instanceof Error ? err.message : 'unknown' });
  process.exitCode = 1;
});
