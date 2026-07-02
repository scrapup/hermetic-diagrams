import type { DiagramFormat } from '../domain.js';
import { HermeticError } from '../errors.js';

/**
 * Barrier 1, step 3 (`plan.md` §5.2): the Security Scanner. Rejects every construct that could make
 * the engine reach outside — **per notation** — before any render happens. This is defense-in-depth
 * behind the `internal: true` network; here a false negative is a critical bug, so the rules err
 * toward refusal and cover the exact vector table in the plan.
 *
 * Design: JSON notations (Vega/Vega-Lite) are inspected by parsing and walking the tree — never by
 * regex. Line-based DSLs use targeted, construct-anchored patterns (not one fragile mega-regex).
 */

/** Network/file URL schemes that indicate a fetchable external reference. */
const URL_SCHEME = /(?:https?|ftps?|file|jar|netdoc|smb|gopher):\/\//i;

/** XML DTD / external-entity tokens (XXE), refused for any notation. */
const DTD_TOKEN = /<!(?:DOCTYPE|ENTITY)\b/i;

function reject(detail: string): never {
  throw new HermeticError(
    'EXTERNAL_REFERENCE',
    'The source references an external resource, which is not allowed. No render was attempted.',
    detail,
  );
}

function scanCommonXml(source: string): void {
  if (DTD_TOKEN.test(source)) {
    reject('XML DTD / external entity declaration detected (XXE vector).');
  }
}

function scanPlantUml(source: string): void {
  // `%getenv` would exfiltrate environment values into the render.
  if (/%getenv\b/i.test(source)) reject('PlantUML `%getenv` is not allowed.');

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    // `!includeurl` is remote by definition.
    if (/^!includeurl\b/i.test(line)) reject('Remote `!includeurl` directive.');
    // `!include` / `!includesub` pointing at a URL.
    if (/^!include(sub)?\b/i.test(line) && URL_SCHEME.test(line)) {
      reject('Remote `!include` directive.');
    }
    // Themes loaded `from <url>`.
    if (/^!theme\b/i.test(line) && URL_SCHEME.test(line)) reject('Remote `!theme ... from <url>`.');
    // Sprites referenced by URL: `<img:https://...>`.
    if (/<img:\s*[^>]*?(?:https?|ftps?|file):\/\//i.test(line)) reject('Remote sprite `<img:url>`.');
  }
}

function scanD2(source: string): void {
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    // Remote spread-import: `...@https://...` or `@import ... url`.
    if (/@\S*/.test(line) && URL_SCHEME.test(line)) reject('Remote D2 `@import`.');
    // `icon: https://...`.
    if (/\bicon\s*:/i.test(line) && URL_SCHEME.test(line)) reject('Remote D2 `icon` URL.');
  }
}

function scanGraphviz(source: string): void {
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    // Attributes that make GraphViz read a resource.
    if (/\b(?:image|imagepath|shapefile|imagescale)\s*=/i.test(line) && URL_SCHEME.test(line)) {
      reject('GraphViz image/imagepath/shapefile URL.');
    }
  }
}

function scanFileReference(source: string): void {
  // DBML / ERD: any external file/URL reference is a vector.
  if (URL_SCHEME.test(source)) reject('External file/URL reference.');
}

function walkJson(node: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, visit);
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      visit(key, value);
      walkJson(value, visit);
    }
  }
}

function scanVega(source: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    // Not valid JSON — the syntax validator owns that. Fall back to a scheme scan, fail-closed.
    scanFileReference(source);
    return;
  }
  walkJson(parsed, (key, value) => {
    // `data.url`, `background` image URLs, `signal`-loaded resources, etc.
    if (key.toLowerCase() === 'url') {
      reject('Vega/Vega-Lite `url` property (remote data/image).');
    }
    if (typeof value === 'string' && URL_SCHEME.test(value)) {
      reject('Vega/Vega-Lite string value references an external URL.');
    }
  });
}

const SCANNERS: Readonly<Record<DiagramFormat, (source: string) => void>> = {
  plantuml: scanPlantUml,
  c4: scanPlantUml,
  d2: scanD2,
  graphviz: scanGraphviz,
  dbml: scanFileReference,
  erd: scanFileReference,
  vega: scanVega,
  'vega-lite': scanVega,
};

/**
 * Enforce the source size limit (before anything else) and run the per-notation security rules.
 * Throws {@link HermeticError} `TOO_LARGE` or `EXTERNAL_REFERENCE`; returns silently when clean.
 */
export function scanSecurity(format: DiagramFormat, source: string, maxSourceBytes: number): void {
  const byteLength = Buffer.byteLength(source, 'utf8');
  if (byteLength > maxSourceBytes) {
    throw new HermeticError(
      'TOO_LARGE',
      `Source exceeds the maximum size of ${maxSourceBytes} bytes (got ${byteLength}).`,
    );
  }

  scanCommonXml(source);
  SCANNERS[format](source);
}
