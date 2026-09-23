import { type DiagramFormat } from '../domain.js';
/**
 * Validate that the source is non-empty, decodable, and structurally plausible for its notation.
 * Throws {@link HermeticError} `EMPTY_CONTENT` or `INVALID_SYNTAX`; returns silently when plausible.
 */
export declare function validateSyntax(format: DiagramFormat, source: string): void;
