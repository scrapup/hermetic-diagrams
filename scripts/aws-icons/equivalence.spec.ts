import { describe, expect, it } from 'vitest';
import { checkEquivalence, spriteNames } from './equivalence.ts';

const icon = (name: string): string => `sprite $${name} [64x64/16z] {\nabc\n}\n!define ${name}(a) X(a)`;

describe('spriteNames', () => {
  it('collects every sprite name, ignoring other definitions', () => {
    expect([...spriteNames(`${icon('A')}\n  sprite $B_2 [1x1] {\n}\n!define C(x) x`)]).toEqual(['A', 'B_2']);
  });
});

describe('checkEquivalence', () => {
  it('passes when the union of the category files equals all.puml', () => {
    const aggregates = new Map([['Storage', `${icon('Backup')}\n${icon('S3')}`]]);
    const members = new Map([['Storage', [icon('S3'), icon('Backup')]]]);
    expect(checkEquivalence(aggregates, members)).toEqual([]);
  });

  it('reports sprites only present in all.puml', () => {
    const aggregates = new Map([['Storage', `${icon('Backup')}\n${icon('S3')}`]]);
    const members = new Map([['Storage', [icon('S3')]]]);
    expect(checkEquivalence(aggregates, members)).toEqual([
      { file: 'Storage/all.puml', rule: 'equivalence: sprites only in all.puml: Backup', line: 0 },
    ]);
  });

  it('reports sprites missing from all.puml', () => {
    const aggregates = new Map([['Storage', icon('S3')]]);
    const members = new Map([['Storage', [icon('S3'), icon('Zeta'), icon('Alpha')]]]);
    expect(checkEquivalence(aggregates, members)).toEqual([
      { file: 'Storage/all.puml', rule: 'equivalence: sprites missing from all.puml: Alpha, Zeta', line: 0 },
    ]);
  });

  it('reports a category whose upstream all.puml is missing', () => {
    expect(checkEquivalence(new Map(), new Map([['Compute', [icon('Lambda')]]]))).toEqual([
      { file: 'Compute/all.puml', rule: 'equivalence: upstream all.puml missing for category', line: 0 },
    ]);
  });

  it('reports an aggregate with no member files', () => {
    expect(checkEquivalence(new Map([['Games', icon('GameLift')]]), new Map())).toEqual([
      { file: 'Games/all.puml', rule: 'equivalence: sprites only in all.puml: GameLift', line: 0 },
    ]);
  });
});
