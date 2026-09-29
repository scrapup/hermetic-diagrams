import net from 'node:net';
import type { HermeticConfig } from '../config.js';
import type { CheckResult } from './types.js';

/**
 * Egress self-check (`plan.md` §5.4, barrier 2): empirically prove there is no external route.
 * The MCP attempts a **SYN-only** TCP connect to a fixed public IP with a short timeout and sends
 * **no payload byte**. Semantics are inverted on purpose: *connecting = containment failure*. In a
 * contained `internal: true` network the connect errors or times out → `pass`.
 */

/** Probe returning `true` if a TCP connection was established, `false` otherwise. */
export type ConnectProbe = (host: string, port: number, timeoutMs: number) => Promise<boolean>;

/** Default probe: opens a socket, resolves on the first of connect/error/timeout, sends nothing. */
export const tcpConnectProbe: ConnectProbe = (host, port, timeoutMs) =>
  new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (connected: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(connected);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });

export async function egressSelfCheck(
  config: HermeticConfig,
  probe: ConnectProbe = tcpConnectProbe,
): Promise<CheckResult> {
  const connected = await probe(
    config.egressCheckHost,
    config.egressCheckPort,
    config.egressCheckTimeoutMs,
  );
  return {
    name: 'egressSelfCheck',
    pass: !connected,
    detail: connected
      ? `Reached ${config.egressCheckHost}:${config.egressCheckPort} — an external route exists.`
      : 'No external route: the outbound connect did not succeed.',
  };
}
