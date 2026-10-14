import { describe, expect, it } from 'vitest';
import type { IconLock, IconLockFile } from '../../src/aws/icon-lock.ts';
import { iconPathParts } from '../../src/aws/path-grammar.ts';
import { diffCatalog, formatReport, nameSimilarity } from './catalog-diff.ts';

function file(path: string, bytes = 100): IconLockFile {
  const parts = iconPathParts(path);
  return { path, ...parts, sha256: 'a'.repeat(64), bytes };
}

function lock(tag: string, paths: string[], bytes = 100): IconLock {
  return {
    $schemaVersion: 1,
    upstream: 'awslabs/aws-icons-for-plantuml',
    tag,
    commit: 'b'.repeat(40),
    tarballSha256: 'c'.repeat(64),
    vendoredOn: '2026-10-14',
    root: `assets/aws-icons/${tag}`,
    files: paths.map((p) => file(p, bytes)),
    categories: {},
    manifestSha256: 'd'.repeat(64),
  };
}

const OLD = lock('v23.0', ['AWSCommon.puml', 'Compute/Lambda.puml', 'Compute/EC2Instance.puml', 'Storage/Backup.puml']);

describe('diffCatalog', () => {
  it('reports a no-op update', () => {
    expect(diffCatalog(OLD.files, OLD.files)).toEqual({ added: [], removed: [], renamedCandidates: [], breaking: false });
  });

  it('reports additions without breaking', () => {
    const next = [...OLD.files, file('Compute/Batch.puml'), file('Analytics/Athena.puml')];
    expect(diffCatalog(OLD.files, next)).toEqual({
      added: ['Analytics/Athena.puml', 'Compute/Batch.puml'],
      removed: [],
      renamedCandidates: [],
      breaking: false,
    });
  });

  it('reports removals as breaking', () => {
    const next = OLD.files.filter((f) => f.path !== 'Storage/Backup.puml');
    expect(diffCatalog(OLD.files, next)).toMatchObject({ removed: ['Storage/Backup.puml'], breaking: true });
  });

  it('pairs a rename in the same category, case-insensitively', () => {
    const next = [...OLD.files.filter((f) => f.path !== 'Compute/EC2Instance.puml'), file('Compute/EC2instances.puml')];
    expect(diffCatalog(OLD.files, next)).toEqual({
      added: ['Compute/EC2instances.puml'],
      removed: ['Compute/EC2Instance.puml'],
      renamedCandidates: [{ from: 'Compute/EC2Instance.puml', to: 'Compute/EC2instances.puml', similarity: 0.92 }],
      breaking: true,
    });
  });

  it('does not pair across categories or below the similarity threshold', () => {
    const next = [...OLD.files.filter((f) => f.path !== 'Compute/Lambda.puml'), file('Storage/Lambda.puml'), file('Compute/Fargate.puml')];
    expect(diffCatalog(OLD.files, next).renamedCandidates).toEqual([]);
  });

  it('treats a missing previous lock as everything added', () => {
    expect(diffCatalog(null, OLD.files)).toMatchObject({ added: OLD.files.map((f) => f.path).sort(), removed: [], breaking: false });
  });
});

describe('nameSimilarity', () => {
  it('is 1 for case-only differences and decreases with edits', () => {
    expect(nameSimilarity('Lambda', 'LAMBDA')).toBe(1);
    expect(nameSimilarity('abcd', 'abce')).toBe(0.75);
    expect(nameSimilarity('', '')).toBe(1);
  });
});

describe('formatReport', () => {
  it('includes tag, commit, tarball sha256, counts, size delta and the lists', () => {
    const next = lock('v23.1', ['AWSCommon.puml', 'Compute/Lambda.puml', 'Compute/EC2Instance.puml', 'Compute/Batch.puml'], 120);
    const report = formatReport(diffCatalog(OLD.files, next.files), next, OLD);
    expect(report).toContain('## AWS icons update: v23.0 → v23.1');
    expect(report).toContain(`| Commit | \`${'b'.repeat(40)}\` |`);
    expect(report).toContain(`| Tarball sha256 | \`${'c'.repeat(64)}\` |`);
    expect(report).toContain('| Files | 4 (0) |');
    expect(report).toContain('| Size | 480 bytes (+80) |');
    expect(report).toContain('| Breaking | **yes** — icons removed |');
    expect(report).toContain('### Added (1)\n\n- `Compute/Batch.puml`');
    expect(report).toContain('### Removed (1)\n\n- `Storage/Backup.puml`');
  });

  it('renders a first vendoring and empty sections', () => {
    const report = formatReport(diffCatalog(OLD.files, OLD.files), OLD, null);
    expect(report).toContain('(none) → v23.0');
    expect(report).toContain('### Removed (0)\n\nNone.');
    expect(report).toContain('| Breaking | no |');
  });
});
