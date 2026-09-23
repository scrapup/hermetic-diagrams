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
export declare function createCanarySink(token: string): Promise<CanarySink>;
