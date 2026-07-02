import http from 'node:http';
import os from 'node:os';
import type { AddressInfo } from 'node:net';

/**
 * An ephemeral in-process HTTP sink used by the boot canary. It binds on the MCP container's own
 * interface — reachable from Kroki over the **internal** network (no egress needed) — and records
 * whether it was ever hit. If the engine resolves the canary's remote include, the sink is hit and
 * containment is broken; if `KROKI_SAFE_MODE=SECURE` refuses it (as it must), the sink stays cold.
 */
export interface CanarySink {
  /** URL to embed in the canary include; reachable from Kroki on the internal network. */
  readonly url: string;
  /** Whether the sink received any request. */
  wasHit(): boolean;
  close(): Promise<void>;
}

/** First non-internal IPv4 of this host/container — the address Kroki can reach on the network. */
function primaryIPv4(): string {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address;
    }
  }
  return '127.0.0.1';
}

export async function createCanarySink(token: string): Promise<CanarySink> {
  let hit = false;
  const server = http.createServer((_req, res) => {
    hit = true;
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(token);
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://${primaryIPv4()}:${port}/canary`,
    wasHit: () => hit,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
