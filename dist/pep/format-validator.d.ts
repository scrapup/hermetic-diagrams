import { type DiagramFormat, type OutputFormat } from '../domain.js';
export interface ValidatedFormat {
    readonly format: DiagramFormat;
    readonly output: OutputFormat;
}
/**
 * Barrier 1, step 1 (`plan.md` §5.2): allowlist the input notation and the output format.
 * `output` defaults to `svg`. Anything outside the allowlists is rejected before any other work.
 */
export declare function validateFormat(input: {
    format: unknown;
    output?: unknown;
}): ValidatedFormat;
