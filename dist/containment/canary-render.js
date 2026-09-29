/**
 * Canary render (`plan.md` §5.4, barrier 3): prove the *engine* does not resolve remote references.
 * A diagram carrying a remote include pointing at an **instrumented sink** is sent to Kroki,
 * bypassing the PEP on purpose. The check passes **only if the sink is never reached** — the same
 * zero-hit assertion as the CI golden test (`plan.md` §7.1), run here at boot in every real
 * environment. As a second signal, the injected token must also be absent from any output.
 */
/** Marker the sink returns; its presence in the output would also indicate a leak. */
export const CANARY_TOKEN = 'HERMETIC_CANARY_LEAK';
/** Build a PlantUML source whose remote include, if resolved, hits the sink and leaks the token. */
export function buildCanarySource(canaryUrl) {
    return `@startuml\n!includeurl ${canaryUrl}\n@enduml`;
}
export async function canaryRender(deps) {
    // Fail-closed: if the sink is not reachable, a cold sink proves nothing (it could be unreachable
    // rather than the include being refused). Refuse rather than pass vacuously.
    if (!deps.sinkReachable()) {
        return {
            name: 'canaryRender',
            pass: false,
            detail: 'Canary sink is not reachable on a routable address; containment cannot be proven.',
        };
    }
    const source = buildCanarySource(deps.canaryUrl);
    let output = null;
    try {
        output = await deps.renderRaw('plantuml', source);
    }
    catch {
        // A refused/failed render means the engine did not resolve the include — contained.
        output = null;
    }
    const tokenLeaked = output !== null && output.includes(CANARY_TOKEN);
    const sinkHit = deps.wasSinkHit();
    const pass = !sinkHit && !tokenLeaked;
    return {
        name: 'canaryRender',
        pass,
        detail: pass
            ? 'The engine refused the remote include; the sink was never reached.'
            : `Containment broken — ${sinkHit ? 'the sink was reached' : 'the leak token appeared in the output'}.`,
    };
}
