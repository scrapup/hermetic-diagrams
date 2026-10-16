import type { DiagramFormat } from '../domain.js';
import type { IconSet } from '../aws/icon-set-store.js';
/**
 * AWS Include Resolver (aws-icons `plan.md` §4.5) — a PEP step between syntax validation and the
 * Security Scanner. It replaces every `!include AWSPuml/<path>` with the **verified, in-memory**
 * content of the shipped icon set, so Kroki receives a self-contained source and never resolves an
 * include itself. The scanner then runs on the expanded source (RN-04).
 *
 * Two upstream helpers get an engine-compatibility override appended (`aws-engine-compat.ts`, D-11).
 *
 * Pure: no filesystem access (enforced by an ESLint `no-restricted-imports` override). Requester
 * input is only ever matched against a grammar and looked up with an exact `Map.get`.
 */
export interface AwsResolverLimits {
    readonly maxSourceBytes: number;
    readonly maxExpandedSourceBytes: number;
    readonly maxAwsIncludes: number;
}
export interface ResolvedSource {
    readonly source: string;
    /** Distinct `AWSPuml/` files inlined. */
    readonly includes: number;
    readonly expandedBytes: number;
}
export declare function resolveAwsIncludes(format: DiagramFormat, source: string, iconSet: IconSet, limits: AwsResolverLimits): ResolvedSource;
