/**
 * Core domain vocabulary shared across the PEP, the render pipeline, and the MCP tools.
 *
 * The allowlists here are the single source of truth for what the MVP accepts — every other
 * module derives its behavior from these constants (Zero Trust: nothing outside the allowlist
 * is ever forwarded to the engine). See `spec.md` RN-05/RN-09/RN-10 and `plan.md` §4.
 */

/** Input notations accepted by the MVP (all local-render, no browser). */
export const INPUT_FORMATS = [
  'plantuml',
  'c4',
  'd2',
  'graphviz',
  'dbml',
  'erd',
  'vega',
  'vega-lite',
] as const;

export type DiagramFormat = (typeof INPUT_FORMATS)[number];

/** Output image formats. SVG is the default; PNG is raster. */
export const OUTPUT_FORMATS = ['svg', 'png'] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Error codes exposed on the tool contract (`plan.md` §4.1). */
export const ERROR_CODES = [
  'INVALID_FORMAT',
  'INVALID_SYNTAX',
  'EXTERNAL_REFERENCE',
  'EMPTY_CONTENT',
  'TOO_LARGE',
  'RENDER_TIMEOUT',
  'RENDER_ERROR',
  'NOT_CONTAINED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Maps an MVP input format to the Kroki diagram-type path segment.
 * Kroki uses `plantuml` for both PlantUML and C4 (C4 is a PlantUML stdlib); the distinction is
 * kept at the PEP so each notation gets its own security rules (`plan.md` §5.2).
 */
export const KROKI_DIAGRAM_TYPE: Readonly<Record<DiagramFormat, string>> = {
  plantuml: 'plantuml',
  c4: 'c4plantuml',
  d2: 'd2',
  graphviz: 'graphviz',
  dbml: 'dbml',
  erd: 'erd',
  vega: 'vega',
  'vega-lite': 'vegalite',
};

export function isInputFormat(value: string): value is DiagramFormat {
  return (INPUT_FORMATS as readonly string[]).includes(value);
}

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value);
}

/** JSON-based notations — validated/scanned by parsing, not by line heuristics. */
export const JSON_FORMATS: ReadonlySet<DiagramFormat> = new Set<DiagramFormat>(['vega', 'vega-lite']);
