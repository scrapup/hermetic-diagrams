/**
 * Strict vendored-content scan (aws-icons `plan.md` §5.5 step 4). The System is a safe source: nothing it ships
 * and injects into a render may read outside the source. These rules are **stricter** than the
 * Requester-facing Security Scanner — any `!include*` (nesting is refused by design, D-05), any
 * environment/JSON/stdlib read, any DTD, and any URL scheme except the exact SVG namespace literal.
 *
 * Used by the update script (blocks an update) and by the shipped-content unit test (catches manual
 * edits). Dependency-free so it runs under Node's native type stripping.
 */

export interface StrictViolation {
  readonly rule: string;
  /** 1-based line number. */
  readonly line: number;
}

export interface FileViolation {
  readonly file: string;
  readonly rule: string;
  /** 1-based line number; `0` when the violation concerns the whole file. */
  readonly line: number;
}

/** Validates a whole source and throws on refusal (the shipped `scanSecurity`, bound to a notation). */
export type SourceScanner = (source: string) => void;

interface StrictRule {
  readonly name: string;
  readonly pattern: RegExp;
}

/** The only URL literal tolerated in vendored content (upstream `AWSExperimental.puml` sprites). */
const SVG_NAMESPACE_LITERAL = 'xmlns="http://www.w3.org/2000/svg"';

const STRICT_RULES: readonly StrictRule[] = [
  { name: 'include', pattern: /^\s*!include/i },
  { name: 'import', pattern: /^\s*!import\b/i },
  { name: 'theme', pattern: /^\s*!theme\b/i },
  { name: 'getenv', pattern: /%getenv\b/i },
  { name: 'load_json', pattern: /%load_json\b/i },
  { name: 'get_all_stdlib', pattern: /%get_all_stdlib\b/i },
  { name: 'dtd', pattern: /<!(?:DOCTYPE|ENTITY)\b/i },
  { name: 'img_scheme', pattern: /<img:\s*[a-z][a-z0-9+.-]*:/i },
];


/**
 * Includes a **guide** may show (aws-icons `plan.md` §5.2): the reserved `AWSPuml/` prefix and the
 * engine's bundled stdlib (`<C4/…>`, `<awslib/…>`). Vendored icon files may include nothing.
 */
const GUIDE_INCLUDE = /^\s*!include(?:_once)?\s+(?:AWSPuml\/[A-Za-z0-9_/]+\.puml|<(?:C4|awslib)\/[A-Za-z0-9_/]+>)\s*$/;

export function isGuideInclude(line: string): boolean {
  return GUIDE_INCLUDE.test(line);
}

export interface StrictScanOptions {
  /** Exempts a line from the `include` rule (guides only). */
  readonly allowInclude?: (line: string) => boolean;
}

/** A PlantUML single-line comment: the first non-blank character is `'`. */
function isCommentLine(line: string): boolean {
  return line.trimStart().startsWith("'");
}

/** Applies the strict rules to every non-comment line. */
export function strictScan(content: string, options: StrictScanOptions = {}): StrictViolation[] {
  const violations: StrictViolation[] = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isCommentLine(line)) return;
    for (const rule of STRICT_RULES) {
      if (rule.name === 'include' && options.allowInclude?.(line) === true) continue;
      if (rule.pattern.test(line)) violations.push({ rule: rule.name, line: index + 1 });
    }
    // `://` is enough to flag an address, and `includes` stays linear on very long lines.
    if (line.split(SVG_NAMESPACE_LITERAL).join('').includes('://')) {
      violations.push({ rule: 'url_scheme', line: index + 1 });
    }
  });
  return violations;
}

function describeRefusal(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const detail: unknown = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
    if (error instanceof Error) return error.message;
  }
  return String(error);
}

/** Strict rules plus the shipped scanner, reported per file. */
export function scanVendoredContent(file: string, content: string, scanner: SourceScanner): FileViolation[] {
  const violations: FileViolation[] = strictScan(content).map((v) => ({ file, rule: v.rule, line: v.line }));
  try {
    scanner(content);
  } catch (error) {
    violations.push({ file, rule: `scanSecurity: ${describeRefusal(error)}`, line: 0 });
  }
  return violations;
}
