import { type ErrorCode } from '../domain.js';
/** Tool error payload, matching the `render_diagram` error contract (`plan.md` §4.1). */
export interface ToolError {
    readonly error: {
        readonly code: ErrorCode;
        readonly message: string;
        readonly detail?: string;
    };
}
/**
 * Translate any thrown value into the tool error contract. Logs a code-only event (never the
 * source, RN-07) and, for unknown errors, collapses to a generic `RENDER_ERROR` so no stack trace
 * or internal detail escapes.
 */
export declare function mapError(err: unknown): ToolError;
