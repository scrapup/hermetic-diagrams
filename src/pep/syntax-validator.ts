import { JSON_FORMATS, type DiagramFormat } from '../domain.js';
import { HermeticError } from '../errors.js';

/**
 * Barrier 1, step 2 (`plan.md` §5.2): a lightweight, per-notation syntax gate that runs **without**
 * the engine. It catches empty/garbled input and obviously-malformed structure early with a
 * descriptive error; deep validity is still Kroki's job. Fail-closed: when it cannot interpret the
 * source safely, it refuses rather than guessing.
 *
 * Detail messages never echo the source (RN-07) — only positions/reasons.
 */

/** U+FFFD (replacement char) or a NUL byte signal a decoding problem upstream. */
// eslint-disable-next-line no-control-regex -- matching a NUL byte is intentional
const BROKEN_ENCODING = new RegExp('[\\uFFFD\\u0000]');

function rejectSyntax(message: string, detail?: string): never {
  throw new HermeticError('INVALID_SYNTAX', message, detail);
}

function validateJsonNotation(format: DiagramFormat, source: string): void {
  try {
    JSON.parse(source);
  } catch (err) {
    const position = err instanceof Error ? /position \d+/.exec(err.message)?.[0] : undefined;
    rejectSyntax(`Invalid ${format} source: not well-formed JSON.`, position ?? 'JSON parse error');
  }
}

function validatePlantUml(source: string): void {
  const starts = (source.match(/@start\w+/gi) ?? []).length;
  const ends = (source.match(/@end\w+/gi) ?? []).length;
  if (starts !== ends) {
    rejectSyntax('Unbalanced @start.../@end... blocks in the PlantUML source.');
  }
}

function validateGraphviz(source: string): void {
  if (!/\b(?:strict\s+)?(?:di)?graph\b/i.test(source)) {
    rejectSyntax('GraphViz source must declare a `graph` or `digraph`.');
  }
  const open = (source.match(/\{/g) ?? []).length;
  const close = (source.match(/\}/g) ?? []).length;
  if (open !== close) rejectSyntax('Unbalanced braces in the GraphViz source.');
}

/**
 * Validate that the source is non-empty, decodable, and structurally plausible for its notation.
 * Throws {@link HermeticError} `EMPTY_CONTENT` or `INVALID_SYNTAX`; returns silently when plausible.
 */
export function validateSyntax(format: DiagramFormat, source: string): void {
  if (source.trim().length === 0) {
    throw new HermeticError('EMPTY_CONTENT', 'The diagram source is empty.');
  }

  if (BROKEN_ENCODING.test(source)) {
    rejectSyntax('The source contains invalid character encoding (replacement or NUL bytes).');
  }

  if (JSON_FORMATS.has(format)) {
    validateJsonNotation(format, source);
    return;
  }

  switch (format) {
    case 'plantuml':
    case 'c4':
      validatePlantUml(source);
      return;
    case 'graphviz':
      validateGraphviz(source);
      return;
    // D2, DBML, ERD: no cheap structural check beyond non-empty/decodable; the engine validates.
    default:
      return;
  }
}
