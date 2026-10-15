import type { DiagramFormat } from '../domain.js';
import type { IconSet } from '../aws/icon-set-store.js';
import { CATEGORY_AGGREGATE, isIconPath } from '../aws/path-grammar.js';
import { HermeticError } from '../errors.js';
import { withEngineShim } from './aws-engine-compat.js';

/**
 * AWS Include Resolver (aws-icons `plan.md` §4.5) — a PEP step between syntax validation and the
 * Security Scanner. It replaces every `!include AWSPuml/<path>` with the **verified, in-memory**
 * content of the shipped icon set, so Kroki receives a self-contained source and never resolves an
 * include itself. The scanner then runs on the expanded source (RN-04).
 *
 * Two upstream helpers get an engine-compatibility override appended (`aws-engine-compat.ts`, D-11).
 *
 * Pure: no filesystem access (enforced by an ESLint `no-restricted-imports` override). Requester
 * input is only ever matched against a grammar and looked up with an exact `Map.get`.
 */

export interface AwsResolverLimits {
  readonly maxSourceBytes: number;
  readonly maxExpandedSourceBytes: number;
  readonly maxAwsIncludes: number;
}

export interface ResolvedSource {
  readonly source: string;
  /** Distinct `AWSPuml/` files inlined. */
  readonly includes: number;
  readonly expandedBytes: number;
}

const AWS_FORMATS: ReadonlySet<DiagramFormat> = new Set<DiagramFormat>(['plantuml', 'c4']);

const PREFIX = 'AWSPuml/';
const COMMON = 'AWSCommon.puml';
/** Base files that build on `AWSCommon.puml` and must come after it. */
const NEEDS_COMMON_BASES: ReadonlySet<string> = new Set(['AWSSimplified.puml', 'AWSExperimental.puml']);

const MENTION = /awspuml/i;
/** `!define AWSPuml …`, `!$AWSPuml = …`, `!global $AWSPuml …` and friends. */
const REDEFINITION = /^!\s*(?:(?:define|definelong|global|local|undef)\s+)?\$?AWSPuml\b/i;
/** The two accepted directive forms; anything else naming `AWSPuml` is refused. */
const RESOLVABLE_INCLUDE = /^!(include|include_once)\s+AWSPuml\/(\S+)$/;
const ANY_INCLUDE = /^!include\w*\b/i;
/** Upstream's documented by-address form, refused with the reserved-convention hint. */
const UPSTREAM_URL = /aws-icons-for-plantuml/i;

/** Linear-time check for an address: `://` is the only thing a URL needs here (no backtracking). */
function hasAddress(line: string): boolean {
  return line.includes('://');
}

const MAX_ECHO = 120;

function echo(path: string): string {
  return path.length > MAX_ECHO ? `${path.slice(0, MAX_ECHO)}…` : path;
}

function unknownReference(path: string, version: string | null): HermeticError {
  return new HermeticError(
    'UNKNOWN_REFERENCE',
    'The source references an AWS icon file that is not in the shipped icon set. No render was attempted.',
    `"${PREFIX}${echo(path)}" is not in the shipped AWS icon set${version !== null ? ` (${version})` : ''}; ` +
      'use list_aws_icons to find the exact include line.',
  );
}

function redefinition(): HermeticError {
  return new HermeticError(
    'EXTERNAL_REFERENCE',
    'The source redefines the reserved `AWSPuml` name, which is not allowed. No render was attempted.',
    'Remove the AWSPuml definition: `!include AWSPuml/<path>` resolves against the shipped icon set ' +
      '(see list_aws_icons); it is never fetched from an address.',
  );
}

function upstreamByAddress(): HermeticError {
  return new HermeticError(
    'EXTERNAL_REFERENCE',
    'The source includes the AWS icon set by internet address, which is not allowed. No render was attempted.',
    'Use the reserved local form instead, e.g. `!include AWSPuml/AWSCommon.puml` then ' +
      '`!include AWSPuml/Compute/Lambda.puml` (see list_aws_icons).',
  );
}

function iconsUnavailable(): HermeticError {
  return new HermeticError(
    'ICONS_UNAVAILABLE',
    'AWS icons are unavailable: the shipped icon set failed its integrity check at startup. No render was attempted.',
    'See containment_status.awsIcons; other notations and non-AWS diagrams are unaffected.',
  );
}

function orderError(path: string): HermeticError {
  return new HermeticError(
    'INVALID_SYNTAX',
    `AWS icon includes must come after \`!include ${PREFIX}${COMMON}\`.`,
    `Move "!include ${PREFIX}${COMMON}" above "!include ${PREFIX}${echo(path)}".`,
  );
}

function tooLarge(limits: AwsResolverLimits, reason: string): HermeticError {
  return new HermeticError(
    'TOO_LARGE',
    `The source is too large once its AWSPuml/ includes are expanded (${reason}).`,
    `expanded: limit ${limits.maxExpandedSourceBytes} bytes after expansion ` +
      `(source limit ${limits.maxSourceBytes} bytes), at most ${limits.maxAwsIncludes} distinct AWSPuml/ includes`,
  );
}

function isComment(trimmed: string): boolean {
  return trimmed.startsWith("'");
}

/** Content for a grammar-valid path: an exact file, or a category's synthetic `all.puml`. */
function lookup(path: string, iconSet: IconSet): string | undefined {
  const direct = iconSet.files.get(path);
  if (direct !== undefined) return direct;
  const slash = path.indexOf('/');
  if (slash === -1 || path.slice(slash + 1) !== CATEGORY_AGGREGATE) return undefined;
  const members = iconSet.categories.get(path.slice(0, slash));
  if (members === undefined) return undefined;
  return members.map((member) => iconSet.files.get(member) ?? '').join('\n');
}

function needsCommon(path: string): boolean {
  return path.includes('/') || NEEDS_COMMON_BASES.has(path);
}

/**
 * Classifies one Requester line. Returns `null` for lines the resolver leaves alone, the
 * grammar-valid path of a resolvable include, or throws the refusal for anything else naming
 * `AWSPuml` (or upstream's by-address form).
 */
function includedPath(trimmed: string, iconSet: IconSet): string | null {
  if (isComment(trimmed)) return null;
  if (ANY_INCLUDE.test(trimmed) && UPSTREAM_URL.test(trimmed) && hasAddress(trimmed)) throw upstreamByAddress();
  if (!MENTION.test(trimmed)) return null;
  if (REDEFINITION.test(trimmed)) throw redefinition();
  if (iconSet.state !== 'VERIFIED') throw iconsUnavailable();

  const path = RESOLVABLE_INCLUDE.exec(trimmed)?.[2];
  if (path === undefined) throw unknownReference(trimmed.replace(/^.*?awspuml\/?/i, ''), iconSet.version);
  if (!isIconPath(path)) throw unknownReference(path, iconSet.version);
  return path;
}

/** Order rule, dedupe and the incremental byte/include budget of one expansion. */
class Expansion {
  private readonly seen = new Set<string>();
  private commonSeen = false;
  bytes: number;

  constructor(
    source: string,
    private readonly limits: AwsResolverLimits,
  ) {
    this.bytes = Buffer.byteLength(source, 'utf8');
  }

  get includes(): number {
    return this.seen.size;
  }

  /** Text that replaces `line`: the inlined content, or `''` for a duplicate (line slot kept). */
  admit(path: string, content: string, line: string): string {
    if (path === COMMON) this.commonSeen = true;
    else if (needsCommon(path) && !this.commonSeen) throw orderError(path);

    const lineBytes = Buffer.byteLength(line, 'utf8');
    if (this.seen.has(path)) {
      this.bytes -= lineBytes;
      return '';
    }
    this.seen.add(path);
    if (this.seen.size > this.limits.maxAwsIncludes) {
      throw tooLarge(this.limits, `more than ${this.limits.maxAwsIncludes} distinct includes`);
    }
    this.bytes += Buffer.byteLength(content, 'utf8') - lineBytes;
    if (this.bytes > this.limits.maxExpandedSourceBytes) {
      throw tooLarge(this.limits, `more than ${this.limits.maxExpandedSourceBytes} bytes`);
    }
    return content;
  }
}

export function resolveAwsIncludes(
  format: DiagramFormat,
  source: string,
  iconSet: IconSet,
  limits: AwsResolverLimits,
): ResolvedSource {
  if (!AWS_FORMATS.has(format) || (!MENTION.test(source) && !UPSTREAM_URL.test(source))) {
    return { source, includes: 0, expandedBytes: Buffer.byteLength(source, 'utf8') };
  }

  // Alternating [line, separator, line, separator, …, line]: CRLF/LF are kept exactly as given.
  const parts = source.split(/(\r?\n)/);
  const expansion = new Expansion(source, limits);
  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i] ?? '';
    const path = includedPath(line.trim(), iconSet);
    if (path === null) continue;
    const verified = lookup(path, iconSet);
    if (verified === undefined) throw unknownReference(path, iconSet.version);
    parts[i] = expansion.admit(path, withEngineShim(path, verified), line);
  }

  return { source: parts.join(''), includes: expansion.includes, expandedBytes: expansion.bytes };
}
