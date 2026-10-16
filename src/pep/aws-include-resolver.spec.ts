import { describe, expect, it } from 'vitest';
import { UNVERIFIED_ICON_SET, shippedIconSet, verifiedIconSet } from '../../test/helpers/icon-sets.js';
import type { ErrorCode } from '../domain.js';
import { HermeticError } from '../errors.js';
import { withEngineShim } from './aws-engine-compat.js';
import { resolveAwsIncludes, type AwsResolverLimits } from './aws-include-resolver.js';

/** AWSCommon as inlined: the verified content followed by its engine shim. */
const C = withEngineShim('AWSCommon.puml', 'COMMON');

const SET = verifiedIconSet({
  'AWSCommon.puml': 'COMMON',
  'AWSSimplified.puml': 'SIMPLIFIED',
  'AWSExperimental.puml': 'EXPERIMENTAL',
  'AWSC4Integration.puml': 'C4INTEGRATION',
  'Compute/Lambda.puml': 'LAMBDA',
  'Compute/EC2.puml': 'EC2',
  'Groups/VPC.puml': 'VPC',
});

const LIMITS: AwsResolverLimits = { maxSourceBytes: 262_144, maxExpandedSourceBytes: 2_097_152, maxAwsIncludes: 200 };

const src = (...lines: string[]): string => ['@startuml', ...lines, '@enduml'].join('\n');

function refusal(fn: () => unknown): HermeticError {
  try {
    fn();
  } catch (err) {
    if (err instanceof HermeticError) return err;
    throw err;
  }
  throw new Error('expected a refusal');
}

function codeOf(source: string, set = SET, limits = LIMITS): ErrorCode {
  return refusal(() => resolveAwsIncludes('plantuml', source, set, limits)).code;
}

describe('resolveAwsIncludes — scope', () => {
  it.each(['d2', 'graphviz', 'dbml', 'erd', 'vega', 'vega-lite'] as const)('leaves %s untouched', (format) => {
    const source = '!include AWSPuml/AWSCommon.puml';
    expect(resolveAwsIncludes(format, source, SET, LIMITS)).toEqual({
      source,
      includes: 0,
      expandedBytes: Buffer.byteLength(source),
    });
  });

  it('leaves a plantuml source without AWSPuml untouched', () => {
    const source = src('!include <awslib/Compute/Lambda>', 'Alice -> Bob');
    expect(resolveAwsIncludes('plantuml', source, SET, LIMITS).source).toBe(source);
  });

  it('does not require a verified set when no AWSPuml line is present', () => {
    const source = src('Alice -> Bob');
    expect(resolveAwsIncludes('plantuml', source, UNVERIFIED_ICON_SET, LIMITS).source).toBe(source);
  });

  it('ignores AWSPuml in comment lines', () => {
    const source = src("' see !define AWSPuml https://example.com", 'Alice -> Bob');
    expect(resolveAwsIncludes('plantuml', source, SET, LIMITS).source).toBe(source);
  });
});

describe('resolveAwsIncludes — resolution', () => {
  it('inlines !include and !include_once in place', () => {
    const result = resolveAwsIncludes(
      'plantuml',
      src('!include AWSPuml/AWSCommon.puml', '  !include_once AWSPuml/Compute/Lambda.puml', 'Lambda(fn, "x", "y")'),
      SET,
      LIMITS,
    );
    expect(result.source).toBe(src(C, 'LAMBDA', 'Lambda(fn, "x", "y")'));
    expect(result.includes).toBe(2);
    expect(result.expandedBytes).toBe(Buffer.byteLength(result.source));
  });

  it('works for the c4 notation', () => {
    const result = resolveAwsIncludes(
      'c4',
      src('!include <C4/C4_Container>', '!include AWSPuml/AWSC4Integration.puml', '!include AWSPuml/AWSCommon.puml'),
      SET,
      LIMITS,
    );
    expect(result.source).toBe(src('!include <C4/C4_Container>', 'C4INTEGRATION', C));
  });

  it('synthesizes <Category>/all.puml from the category files in manifest order', () => {
    const result = resolveAwsIncludes(
      'plantuml',
      src('!include AWSPuml/AWSCommon.puml', '!include AWSPuml/Compute/all.puml'),
      SET,
      LIMITS,
    );
    expect(result.source).toBe(src(C, 'LAMBDA\nEC2'));
  });

  it('inlines a duplicate once and leaves an empty line in its place', () => {
    const result = resolveAwsIncludes(
      'plantuml',
      src('!include AWSPuml/AWSCommon.puml', '!include AWSPuml/Compute/Lambda.puml', '!include_once AWSPuml/Compute/Lambda.puml', 'X'),
      SET,
      LIMITS,
    );
    expect(result.source).toBe(src(C, 'LAMBDA', '', 'X'));
    expect(result.includes).toBe(2);
    expect(result.source.split('\n')).toHaveLength(6 + C.split('\n').length - 1);
  });

  it('preserves mixed CRLF/LF line endings', () => {
    const source = '@startuml\r\n!include AWSPuml/AWSCommon.puml\n!include AWSPuml/Groups/VPC.puml\r\n@enduml';
    expect(resolveAwsIncludes('plantuml', source, SET, LIMITS).source).toBe(`@startuml\r\n${C}\nVPC\r\n@enduml`);
  });

  it('lets `!$AWS_DARK = true` before AWSCommon pass through', () => {
    const result = resolveAwsIncludes('plantuml', src('!$AWS_DARK = true', '!include AWSPuml/AWSCommon.puml'), SET, LIMITS);
    expect(result.source).toBe(src('!$AWS_DARK = true', C));
  });

  it('leaves the PlantUML stdlib `<awslib/...>` include untouched next to AWSPuml includes', () => {
    const result = resolveAwsIncludes(
      'plantuml',
      src('!include <awslib/AWSCommon>', '!include AWSPuml/AWSCommon.puml'),
      SET,
      LIMITS,
    );
    expect(result.source).toBe(src('!include <awslib/AWSCommon>', C));
  });

  it('allows AWSC4Integration before AWSCommon (it does not build on it)', () => {
    expect(() =>
      resolveAwsIncludes('c4', src('!include AWSPuml/AWSC4Integration.puml', '!include AWSPuml/AWSCommon.puml'), SET, LIMITS),
    ).not.toThrow();
  });
});

describe('resolveAwsIncludes — refusals', () => {
  it.each([
    ['!define AWSPuml https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/v23.1/dist'],
    ['!define AWSPuml http://sink.example/'],
    ['!$AWSPuml = "https://sink.example"'],
    ['!global $AWSPuml = "x"'],
    ['  !definelong AWSPuml'],
  ])('refuses the redefinition %j as EXTERNAL_REFERENCE', (line) => {
    expect(codeOf(src(line, '!include AWSPuml/AWSCommon.puml'))).toBe('EXTERNAL_REFERENCE');
  });

  it('refuses a redefinition even when the set is unverified', () => {
    expect(codeOf(src('!define AWSPuml http://sink/'), UNVERIFIED_ICON_SET)).toBe('EXTERNAL_REFERENCE');
  });

  it('refuses the upstream by-address include with the reserved-convention hint', () => {
    const err = refusal(() =>
      resolveAwsIncludes(
        'plantuml',
        src('!include https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/v23.1/dist/AWSCommon.puml'),
        SET,
        LIMITS,
      ),
    );
    expect(err.code).toBe('EXTERNAL_REFERENCE');
    expect(err.detail).toContain('!include AWSPuml/AWSCommon.puml');
  });

  it('refuses any AWSPuml include when the set is UNVERIFIED', () => {
    expect(codeOf(src('!include AWSPuml/AWSCommon.puml'), UNVERIFIED_ICON_SET)).toBe('ICONS_UNAVAILABLE');
  });

  it('refuses an unknown icon naming the path and pointing to discovery', () => {
    const err = refusal(() =>
      resolveAwsIncludes('plantuml', src('!include AWSPuml/AWSCommon.puml', '!include AWSPuml/Compute/Lambdda.puml'), SET, LIMITS),
    );
    expect(err.code).toBe('UNKNOWN_REFERENCE');
    expect(err.detail).toContain('AWSPuml/Compute/Lambdda.puml');
    expect(err.detail).toContain('list_aws_icons');
    expect(err.detail).toContain('v23.1');
  });

  it.each([
    'AWSPuml/../AWSCommon.puml',
    'AWSPuml/%2e%2e/AWSCommon.puml',
    'AWSPuml//etc/passwd.puml',
    'AWSPuml/Compute\\Lambda.puml',
    'AWSPuml/Compute/Sub/Lambda.puml',
    'AWSPuml/Compute/Lambda',
    'AWSPuml/Compute/Lambda.puml!SPRITE',
    'AWSPuml/all.puml',
    'AWSPuml/Nope/all.puml',
  ])('refuses the escape or invalid path %s as UNKNOWN_REFERENCE', (ref) => {
    expect(codeOf(src('!include AWSPuml/AWSCommon.puml', `!include ${ref}`))).toBe('UNKNOWN_REFERENCE');
  });

  it.each([
    '!includesub AWSPuml/Compute/Lambda.puml!X',
    '!include_many AWSPuml/Compute/Lambda.puml',
    '!includeurl AWSPuml/Compute/Lambda.puml',
    '!include <AWSPuml/Compute/Lambda>',
    '!INCLUDE AWSPuml/Compute/Lambda.puml',
    '!include awspuml/Compute/Lambda.puml',
    'rectangle "AWSPuml/x"',
  ])('refuses any other AWSPuml mention %j as UNKNOWN_REFERENCE', (line) => {
    expect(codeOf(src('!include AWSPuml/AWSCommon.puml', line))).toBe('UNKNOWN_REFERENCE');
  });

  it('truncates a very long unknown path in the detail', () => {
    const err = refusal(() => resolveAwsIncludes('plantuml', src(`!include AWSPuml/${'A'.repeat(500)}.puml`), SET, LIMITS));
    expect(err.detail?.length).toBeLessThan(300);
  });

  it.each(['Compute/Lambda.puml', 'Groups/VPC.puml', 'AWSSimplified.puml', 'AWSExperimental.puml', 'Compute/all.puml'])(
    'refuses %s before AWSCommon with INVALID_SYNTAX and the fix',
    (path) => {
      const err = refusal(() =>
        resolveAwsIncludes('plantuml', src(`!include AWSPuml/${path}`, '!include AWSPuml/AWSCommon.puml'), SET, LIMITS),
      );
      expect(err.code).toBe('INVALID_SYNTAX');
      expect(err.detail).toContain('Move "!include AWSPuml/AWSCommon.puml" above');
    },
  );

  it('refuses more distinct includes than MAX_AWS_INCLUDES', () => {
    const err = refusal(() =>
      resolveAwsIncludes(
        'plantuml',
        src('!include AWSPuml/AWSCommon.puml', '!include AWSPuml/Compute/Lambda.puml', '!include AWSPuml/Compute/EC2.puml'),
        SET,
        { ...LIMITS, maxAwsIncludes: 2 },
      ),
    );
    expect(err.code).toBe('TOO_LARGE');
    expect(err.detail).toMatch(/^expanded: /);
    expect(err.detail).toContain('2097152 bytes');
    expect(err.detail).toContain('262144 bytes');
  });

  it('counts duplicates once against MAX_AWS_INCLUDES', () => {
    expect(() =>
      resolveAwsIncludes(
        'plantuml',
        src('!include AWSPuml/AWSCommon.puml', '!include AWSPuml/AWSCommon.puml'),
        SET,
        { ...LIMITS, maxAwsIncludes: 1 },
      ),
    ).not.toThrow();
  });

  it('refuses an expansion beyond MAX_EXPANDED_SOURCE_BYTES', () => {
    const big = verifiedIconSet({ 'AWSCommon.puml': 'x'.repeat(5_000) });
    const err = refusal(() =>
      resolveAwsIncludes('plantuml', src('!include AWSPuml/AWSCommon.puml'), big, {
        ...LIMITS,
        maxSourceBytes: 1_000,
        maxExpandedSourceBytes: 4_000,
      }),
    );
    expect(err.code).toBe('TOO_LARGE');
    expect(err.detail).toContain('4000 bytes');
    expect(err.detail).toContain('1000 bytes');
  });
});

describe('resolveAwsIncludes — real shipped set', () => {
  it('expands a c4 diagram with AWSC4Integration and icons', async () => {
    const set = await shippedIconSet();
    const result = resolveAwsIncludes(
      'c4',
      src(
        '!include <C4/C4_Container>',
        '!include AWSPuml/AWSC4Integration.puml',
        '!include AWSPuml/AWSCommon.puml',
        '!include AWSPuml/Compute/Lambda.puml',
        'Container(fn, "Handler", "Lambda", $sprite="Lambda")',
      ),
      set,
      LIMITS,
    );
    expect(result.includes).toBe(3);
    expect(result.source).toContain('sprite $Lambda');
    expect(result.source).not.toMatch(/^!include AWSPuml/m);
  });

  it('expands Storage/all.puml to the same sprites as the individual files', async () => {
    const set = await shippedIconSet();
    const result = resolveAwsIncludes('plantuml', src('!include AWSPuml/AWSCommon.puml', '!include AWSPuml/Storage/all.puml'), set, LIMITS);
    const sprites = result.source.match(/^sprite \$\w+/gm) ?? [];
    expect(sprites.length).toBe(set.categories.get('Storage')?.length);
  });
});

describe('resolveAwsIncludes — very long lines (behaviour; the time budget lives in the perf project)', () => {
  const BIG = { ...LIMITS, maxSourceBytes: 1e7, maxExpandedSourceBytes: 1e7 };

  it('passes through a 250k-char include naming the upstream without an address', () => {
    const source = src(`!include aws-icons-for-plantuml${'a'.repeat(250_000)}`);
    expect(resolveAwsIncludes('plantuml', source, SET, BIG).source).toBe(source);
  });

  it('refuses a 250k-char AWSPuml mention as UNKNOWN_REFERENCE with a truncated detail', () => {
    const err = refusal(() => resolveAwsIncludes('plantuml', src(`!include AWSPuml/${'a'.repeat(250_000)}`), SET, BIG));
    expect(err.code).toBe('UNKNOWN_REFERENCE');
    expect(err.detail?.length).toBeLessThan(300);
  });
});
