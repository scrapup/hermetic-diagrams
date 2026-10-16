import type { DiagramFormat } from '../domain.js';
/** Which limit a size check enforces: the Requester's raw source, or the source after expansion. */
export type SizeSubject = 'source' | 'expanded';
/**
 * Enforce the source size limit. This is the **first** PEP gate — the pipeline calls it before any
 * parsing/regex so an oversized payload is rejected before it can be scanned (local-DoS defense,
 * `plan.md` §5.5). Throws {@link HermeticError} `TOO_LARGE`; `detail` names the limit that was hit.
 */
export declare function assertSourceSize(source: string, maxSourceBytes: number, subject?: SizeSubject): void;
/**
 * Enforce the source size limit (again, defensively) and run the per-notation security rules.
 * Throws {@link HermeticError} `TOO_LARGE` or `EXTERNAL_REFERENCE`; returns silently when clean.
 */
export declare function scanSecurity(format: DiagramFormat, source: string, maxSourceBytes: number, subject?: SizeSubject): void;
