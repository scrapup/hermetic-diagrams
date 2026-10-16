import type { ErrorCode } from './domain.js';
/**
 * The single error type raised across the pipeline. Carrying a stable {@link ErrorCode} lets the
 * error mapper (`src/server/error-mapper.ts`) translate any failure into the tool contract without
 * leaking stack traces or — critically — the diagram source (RN-07).
 */
export declare class HermeticError extends Error {
    readonly code: ErrorCode;
    readonly detail: string | undefined;
    constructor(code: ErrorCode, message: string, detail?: string);
}
/** Type guard used by the error mapper. */
export declare function isHermeticError(value: unknown): value is HermeticError;
