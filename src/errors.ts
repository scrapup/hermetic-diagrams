import type { ErrorCode } from './domain.js';

/**
 * The single error type raised across the pipeline. Carrying a stable {@link ErrorCode} lets the
 * error mapper (`src/server/error-mapper.ts`) translate any failure into the tool contract without
 * leaking stack traces or — critically — the diagram source (RN-07).
 */
export class HermeticError extends Error {
  readonly code: ErrorCode;
  readonly detail: string | undefined;

  constructor(code: ErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'HermeticError';
    this.code = code;
    this.detail = detail;
  }
}

/** Type guard used by the error mapper. */
export function isHermeticError(value: unknown): value is HermeticError {
  return value instanceof HermeticError;
}
