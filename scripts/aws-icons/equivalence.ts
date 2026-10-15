/**
 * `all.puml` equivalence (`plan.md` §5.5 step 5, D-04). The upstream per-category `all.puml` is not
 * shipped; the resolver synthesizes it by concatenating the category's files. This proves, at update
 * time, that the synthesized aggregate defines exactly the sprites upstream's does.
 */
import { compareCodePoints } from '../../src/aws/icon-lock.ts';
import type { FileViolation } from '../../src/aws/vendored-scan.ts';

const SPRITE = /^\s*sprite\s+\$([A-Za-z0-9_]+)/gm;

export function spriteNames(content: string): Set<string> {
  return new Set(Array.from(content.matchAll(SPRITE), (m) => m[1] ?? ''));
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort(compareCodePoints);
}

/**
 * @param aggregates category → upstream `all.puml` content
 * @param members category → contents of the category's individual files
 */
export function checkEquivalence(
  aggregates: ReadonlyMap<string, string>,
  members: ReadonlyMap<string, readonly string[]>,
): FileViolation[] {
  const violations: FileViolation[] = [];
  const categories = sorted(new Set([...aggregates.keys(), ...members.keys()]));
  for (const category of categories) {
    const file = `${category}/all.puml`;
    const aggregate = aggregates.get(category);
    if (aggregate === undefined) {
      violations.push({ file, rule: 'equivalence: upstream all.puml missing for category', line: 0 });
      continue;
    }
    const expected = spriteNames(aggregate);
    const actual = new Set<string>();
    for (const content of members.get(category) ?? []) {
      for (const name of spriteNames(content)) actual.add(name);
    }
    const missing = sorted([...expected].filter((n) => !actual.has(n)));
    const extra = sorted([...actual].filter((n) => !expected.has(n)));
    if (missing.length > 0) {
      violations.push({ file, rule: `equivalence: sprites only in all.puml: ${missing.join(', ')}`, line: 0 });
    }
    if (extra.length > 0) {
      violations.push({ file, rule: `equivalence: sprites missing from all.puml: ${extra.join(', ')}`, line: 0 });
    }
  }
  return violations;
}
