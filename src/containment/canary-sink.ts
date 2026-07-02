import http from 'node:http';
import os from 'node:os';
import type { AddressInfo } from 'node:net';

/**
 * An ephemeral in-process HTTP sink used by the boot canary. It binds on the MCP container's own
 * routable interface — reachable from Kroki over the **internal** network (no egress needed) — and
 * records whether the `/canary` path was ever hit. If the engine resolves the canary's remote
 * include, the sink is hit and containment is broken; if `KROKI_SAFE_MODE=SECURE` refuses it (as it
 * must), the sink stays cold.
 *
 * Fail-closed reachability: if there is no non-loopback IPv4 (the sink would be unreachable from
 * Kroki), or a self-probe cannot reach the bound address, `routable` is false — the canary must then
 * fail rather than pass vacuously.
 */
export interface CanarySink {
  /** URL to embed in the canary include; reachable from Kroki on the internal network. */
  readonly url: string;
  /** Whether the sink is bound on a routable address and answered a self-probe. */
  readonly routable: boolean;
  /** Whether the `/canary` path received a request. */
  wasHit(): boolean;
  close(): Promise<void>;
}

/** First non-internal IPv4 of this host/container, or null when only loopback exists. */
function primaryIPv4(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address;
    }
  }
  return null;
}

export async function createCanarySink(token: string): Promise<CanarySink> {
  let hit = false;
  const server = http.createServer((req, res) => {
    // Only the canary include path counts as a leak; the self-probe uses a different path.
    if ((req.url ?? '').includes('canary')) hit = true;
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(token);
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const { port } = server.address() as AddressInfo;

  const ip = primaryIPv4();
  const base = ip !== null ? `http://${ip}:${port}` : `http://127.0.0.1:${port}`;

  // Positive reachability proof: confirm the bound address answers a probe (not on the canary path).
  let routable = ip !== null;
  if (routable) {
    try {
      const res = await fetch(`${base}/probe`);
      routable = res.ok;
    } catch {
      routable = false;
    }
  }

  return {
    url: `${base}/canary`,
    routable,
    wasHit: () => hit,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
