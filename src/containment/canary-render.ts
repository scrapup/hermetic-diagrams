import type { CheckResult } from './types.js';

/**
 * Canary render (`plan.md` §5.4, barrier 3): prove the *engine* does not resolve remote references.
 * A diagram carrying a remote include is sent to Kroki **bypassing the PEP on purpose**; if the
 * engine resolved it, the injected token would appear in the output → `NOT_CONTAINED`.
 *
 * This is the same mechanism as the CI golden test (`plan.md` §7.1): there a real instrumented sink
 * asserts *zero network hits*; at boot — with no sink infrastructure — we assert the engine refuses
 * the include (SAFE_MODE), which together with the egress self-check covers both network and engine.
 */

/** Marker that would only appear in the output if the engine fetched the canary reference. */
export const CANARY_TOKEN = 'HERMETIC_CANARY_LEAK';

/** Build a PlantUML source whose remote include, if resolved, leaks {@link CANARY_TOKEN}. */
export function buildCanarySource(canaryUrl: string): string {
  return `@startuml\n!includeurl ${canaryUrl}\n@enduml`;
}

export interface CanaryDeps {
  /** Render raw source via the engine, bypassing the PEP. Returns the output text, or null on refusal/error. */
  readonly renderRaw: (diagramType: string, source: string) => Promise<string | null>;
  /** URL the canary include points at; if the engine fetched it, the output would carry the token. */
  readonly canaryUrl: string;
}

export async function canaryRender(deps: CanaryDeps): Promise<CheckResult> {
  const source = buildCanarySource(deps.canaryUrl);
  let output: string | null = null;
  try {
    output = await deps.renderRaw('plantuml', source);
  } catch {
    // A refused/failed render means the engine did not resolve the include — contained.
    output = null;
  }

  const leaked = output !== null && output.includes(CANARY_TOKEN);
  return {
    name: 'canaryRender',
    pass: !leaked,
    detail: leaked
      ? 'The engine resolved a remote include — containment is broken.'
      : 'The engine refused the remote include.',
  };
}
