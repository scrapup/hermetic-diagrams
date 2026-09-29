import type { HermeticConfig } from '../config.js';
import { type FetchLike } from '../render/kroki-client.js';
import { type ConnectProbe } from './egress-check.js';
import { type CanaryDeps } from './canary-render.js';
import type { ContainmentReport } from './types.js';
/**
 * Boot gate (`plan.md` §5.4): run the containment proofs in order — Kroki healthcheck → egress
 * self-check → canary — and consolidate them. The caller registers the render tools **only** when
 * `contained` is true; otherwise the gateway is fail-closed (`NOT_CONTAINED`).
 */
export interface BootGateDeps {
    readonly config: HermeticConfig;
    /** Resolves `true` when Kroki reports ready. */
    readonly checkKrokiHealth: () => Promise<boolean>;
    readonly canary: CanaryDeps;
    readonly egressProbe?: ConnectProbe;
}
export declare function runBootGate(deps: BootGateDeps): Promise<ContainmentReport>;
/** Default Kroki healthcheck: GET `${baseUrl}/health`, expecting a 2xx. */
export declare function defaultKrokiHealth(config: HermeticConfig, fetchImpl?: FetchLike): () => Promise<boolean>;
/** Default `renderRaw`: render raw PlantUML via the internal Kroki, decoding the SVG output to text. */
export declare function defaultRenderRaw(config: HermeticConfig, fetchImpl?: FetchLike): CanaryDeps['renderRaw'];
/**
 * Convenience used by the entrypoint: prove containment with the default, live dependencies. Spins
 * up an ephemeral in-process sink so the canary can assert a real zero-hit (not a vacuous token
 * check), then tears it down.
 */
export declare function proveContainment(config: HermeticConfig, fetchImpl?: FetchLike): Promise<ContainmentReport>;
