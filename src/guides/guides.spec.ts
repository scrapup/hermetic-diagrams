import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isGuideInclude, strictScan } from '../../scripts/aws-icons/vendored-scan.ts';
import { shippedIconSet } from '../../test/helpers/icon-sets.js';
import { loadConfig } from '../config.js';
import { INPUT_FORMATS } from '../domain.js';
import { resolveAwsIncludes } from '../pep/aws-include-resolver.js';
import { validateFormat } from '../pep/format-validator.js';
import { assertSourceSize, scanSecurity } from '../pep/security-scanner.js';
import { validateSyntax } from '../pep/syntax-validator.js';
import { extractExamples } from './guide-examples.js';
import { AWS_GUIDE_IDS, GUIDE_IDS } from './guide-ids.js';

/**
 * The shipped guides are proven by construction (aws-icons RN-13, RN-14, RN-16):
 * coverage of every notation and AWS kind, fixed sections, every example accepted by the full PEP
 * (no Docker; the integration suite renders them), and no construct the System refuses anywhere in
 * the text.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUIDES_DIR = path.join(ROOT, 'assets', 'guides');
const SECTIONS = ['## When to use', '## Building blocks', '## Refused here (and what to use instead)', '## Examples'];

const read = (id: string): string => readFileSync(path.join(GUIDES_DIR, `${id}.md`), 'utf8').replace(/\r\n/g, '\n');

describe('authoring guides — coverage', () => {
  it('has exactly one guide per supported notation and per AWS diagram kind', () => {
    expect([...GUIDE_IDS].sort()).toEqual([...INPUT_FORMATS, ...AWS_GUIDE_IDS].sort());
    const shipped = readdirSync(GUIDES_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.slice(0, -3))
      .sort();
    expect(shipped).toEqual([...GUIDE_IDS].sort());
  });
});

describe.each(GUIDE_IDS)('authoring guide %s', (id) => {
  const markdown = read(id);

  it('starts with a title and a summary paragraph', () => {
    const lines = markdown.split('\n');
    expect(lines[0]).toMatch(/^# \S/);
    expect(lines[1]).toBe('');
    expect(lines[2]?.trim().length).toBeGreaterThan(0);
  });

  it('has the four fixed sections, in order', () => {
    const positions = SECTIONS.map((s) => markdown.split('\n').indexOf(s));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('has at least one executable example', () => {
    expect(extractExamples(markdown).length).toBeGreaterThan(0);
  });

  it('passes every example through the full PEP (format → syntax → resolver → scanner)', async () => {
    const iconSet = await shippedIconSet();
    const config = loadConfig();
    for (const example of extractExamples(markdown)) {
      const { format } = validateFormat({ format: example.format, output: example.output });
      assertSourceSize(example.source, config.maxSourceBytes);
      validateSyntax(format, example.source);
      const resolved = resolveAwsIncludes(format, example.source, iconSet, config);
      expect(() => scanSecurity(format, resolved.source, config.maxExpandedSourceBytes, 'expanded')).not.toThrow();
    }
  });

  it('contains no construct the System refuses (safe-source static check)', () => {
    expect(strictScan(markdown, { allowInclude: isGuideInclude })).toEqual([]);
  });
});
