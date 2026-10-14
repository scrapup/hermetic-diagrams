import { describe, expect, it } from 'vitest';
import { scanVendoredContent, strictScan } from './vendored-scan.ts';

const CLEAN = [
  "' Copyright 2019 Amazon.com. See https://github.com/awslabs/aws-icons-for-plantuml/blob/main/LICENSE",
  'sprite $Lambda [64x64/16z] {',
  'xPC5TiLG509vclslk7PhKv',
  '}',
  '!function $LambdaIMG($scale=1)',
  '!return "<img data:image/png;base64,iVBORw0KGgo{scale=" + $scale + "}>"',
  '!endfunction',
  '!define Lambda(e_alias, e_label, e_techn) AWSEntity(e_alias, e_label, e_techn, #ED7100, Lambda, Lambda)',
].join('\n');

describe('strictScan', () => {
  it('accepts a clean upstream-style icon (URLs only in comment lines)', () => {
    expect(strictScan(CLEAN)).toEqual([]);
  });

  it('accepts the exact SVG namespace literal', () => {
    expect(strictScan('sprite $X <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>')).toEqual([]);
  });

  it.each([
    ['include', '!include Other/Thing.puml'],
    ['include', '  !include_once AWSPuml/AWSCommon.puml'],
    ['include', '!includeurl https://example.com/x.puml'],
    ['include', '!includesub Foo.puml!BAR'],
    ['import', '!import lib.zip'],
    ['theme', '!theme cerulean'],
    ['getenv', '!$x = %getenv("HOME")'],
    ['load_json', '!$j = %load_json("data.json")'],
    ['get_all_stdlib', '!$s = %get_all_stdlib()'],
    ['dtd', '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>'],
    ['dtd', '<!ENTITY x "y">'],
    ['img_scheme', 'rectangle "<img:https://example.com/a.png>"'],
    ['img_scheme', 'rectangle "<img: file:/etc/passwd>"'],
    ['url_scheme', 'note: see https://example.com'],
    ['url_scheme', 'sprite $X <svg xmlns="http://www.w3.org/2000/svg" href="http://evil/"></svg>'],
    ['url_scheme', 'sprite $X <svg xmlns="https://www.w3.org/2000/svg"></svg>'],
  ])('flags rule %s in %j', (rule, line) => {
    expect(strictScan(line).map((v) => v.rule)).toContain(rule);
  });

  it('reports 1-based line numbers', () => {
    expect(strictScan('ok\n!import x')).toEqual([{ rule: 'import', line: 2 }]);
  });

  it('does not strip a quote that is not at the start of the line', () => {
    expect(strictScan("label 'x' https://example.com").map((v) => v.rule)).toEqual(['url_scheme']);
  });
});

describe('scanVendoredContent', () => {
  it('prefixes violations with the file path', () => {
    expect(scanVendoredContent('Compute/Bad.puml', '!import x', () => undefined)).toEqual([
      { file: 'Compute/Bad.puml', rule: 'import', line: 1 },
    ]);
  });

  it('runs the shipped security scanner and records its refusal', () => {
    const scanner = (): void => {
      throw new Error('Remote `!include` directive.');
    };
    expect(scanVendoredContent('AWSCommon.puml', CLEAN, scanner)).toEqual([
      { file: 'AWSCommon.puml', rule: 'scanSecurity: Remote `!include` directive.', line: 0 },
    ]);
  });

  it('uses the error detail when the scanner provides one', () => {
    const scanner = (): void => {
      throw Object.assign(new Error('generic'), { detail: 'specific detail' });
    };
    expect(scanVendoredContent('A.puml', CLEAN, scanner)[0]?.rule).toBe('scanSecurity: specific detail');
  });

  it('returns no violation for clean content accepted by the scanner', () => {
    expect(scanVendoredContent('A.puml', CLEAN, () => undefined)).toEqual([]);
  });
});
