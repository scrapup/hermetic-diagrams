import {} from '../domain.js';
import { isHermeticError } from '../errors.js';
import { logger } from '../logger.js';
/** Codes that represent a rejected *request* (client error) rather than an engine failure. */
const REJECTION_CODES = new Set([
    'INVALID_FORMAT',
    'INVALID_SYNTAX',
    'EXTERNAL_REFERENCE',
    'EMPTY_CONTENT',
    'TOO_LARGE',
]);
/**
 * Translate any thrown value into the tool error contract. Logs a code-only event (never the
 * source, RN-07) and, for unknown errors, collapses to a generic `RENDER_ERROR` so no stack trace
 * or internal detail escapes.
 */
export function mapError(err) {
    if (isHermeticError(err)) {
        if (REJECTION_CODES.has(err.code)) {
            logger.warn('request.rejected', { code: err.code });
        }
        else {
            logger.error('render.error', { code: err.code });
        }
        return {
            error: {
                code: err.code,
                message: err.message,
                ...(err.detail !== undefined ? { detail: err.detail } : {}),
            },
        };
    }
    logger.error('render.error', { code: 'RENDER_ERROR' });
    return {
        error: {
            code: 'RENDER_ERROR',
            message: 'An unexpected error occurred while rendering.',
        },
    };
}
