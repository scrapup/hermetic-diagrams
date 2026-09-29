import type { CheckResult } from './types.js';
/**
 * Canary render (`plan.md` §5.4, barrier 3): prove the *engine* does not resolve remote references.
 * A diagram carrying a remote include pointing at an **instrumented sink** is sent to Kroki,
 * bypassing the PEP on purpose. The check passes **only if the sink is never reached** — the same
 * zero-hit assertion as the CI golden test (`plan.md` §7.1), run here at boot in every real
 * environment. As a second signal, the injected token must also be absent from any output.
 */
/** Marker the sink returns; its presence in the output would also indicate a leak. */
export declare const CANARY_TOKEN = "HERMETIC_CANARY_LEAK";
/** Build a PlantUML source whose remote include, if resolved, hits the sink and leaks the token. */
export declare function buildCanarySource(canaryUrl: string): string;
export interface CanaryDeps {
    /** Render raw source via the engine, bypassing the PEP. Returns the output text, or null on refusal/error. */
    readonly renderRaw: (diagramType: string, source: string) => Promise<string | null>;
    /** URL of the instrumented sink the canary include points at. */
    readonly canaryUrl: string;
    /** Whether the sink received a request during/after the render. */
    readonly wasSinkHit: () => boolean;
    /** Whether the sink is on a routable address the engine could actually reach. */
    readonly sinkReachable: () => boolean;
}
export declare function canaryRender(deps: CanaryDeps): Promise<CheckResult>;
