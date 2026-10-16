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
export declare const tcpConnectProbe: ConnectProbe;
export declare function egressSelfCheck(config: HermeticConfig, probe?: ConnectProbe): Promise<CheckResult>;
