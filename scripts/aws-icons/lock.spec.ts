import { describe, expect, it } from 'vitest';
import { canonicalFilesJson, sha256Hex } from '../../src/aws/icon-lock.ts';
import { buildLock, serializeLock, type LockInput } from './lock.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

const COMMIT = 'b788ba79e8cd028be274761f0fadd8bf3b711acd';
const TARBALL = 'c'.repeat(64);

function input(overrides: Partial<LockInput> = {}): LockInput {
  return {
    tag: 'v23.1',
    commit: COMMIT,
    tarballSha256: TARBALL,
    today: '2026-10-14',
    files: new Map([
      ['Storage/SimpleStorageService.puml', enc('s3')],
      ['AWSCommon.puml', enc('common')],
      ['Groups/VPC.puml', enc('vpc')],
      ['Storage/Backup.puml', enc('backup')],
      ['Compute/Lambda.puml', enc('lambda')],
    ]),
    ...overrides,
  };
}

describe('buildLock', () => {
  it('sorts files by path and classifies kind/category/name', () => {
    const lock = buildLock(input());
    expect(lock.files.map((f) => [f.path, f.kind, f.category, f.name])).toEqual([
      ['AWSCommon.puml', 'base', null, 'AWSCommon'],
      ['Compute/Lambda.puml', 'icon', 'Compute', 'Lambda'],
      ['Groups/VPC.puml', 'group', 'Groups', 'VPC'],
      ['Storage/Backup.puml', 'icon', 'Storage', 'Backup'],
      ['Storage/SimpleStorageService.puml', 'icon', 'Storage', 'SimpleStorageService'],
    ]);
  });

  it('records sha256 and byte size per file', () => {
    const file = buildLock(input()).files.find((f) => f.path === 'Compute/Lambda.puml');
    expect(file).toMatchObject({ sha256: sha256Hex('lambda'), bytes: 6 });
  });

  it('builds categories (no base files) in manifest order', () => {
    expect(buildLock(input()).categories).toEqual({
      Compute: ['Lambda'],
      Groups: ['VPC'],
      Storage: ['Backup', 'SimpleStorageService'],
    });
  });

  it('pins the release and derives the root from the tag', () => {
    expect(buildLock(input())).toMatchObject({
      $schemaVersion: 1,
      upstream: 'awslabs/aws-icons-for-plantuml',
      tag: 'v23.1',
      commit: COMMIT,
      tarballSha256: TARBALL,
      vendoredOn: '2026-10-14',
      root: 'assets/aws-icons/v23.1',
    });
  });

  it('covers the canonical files JSON with manifestSha256', () => {
    const lock = buildLock(input());
    expect(lock.manifestSha256).toBe(sha256Hex(canonicalFilesJson(lock.files)));
  });

  it('is byte-identical across runs regardless of input order (determinism)', () => {
    const reversed = new Map([...input().files.entries()].reverse());
    expect(serializeLock(buildLock(input({ files: reversed })))).toBe(serializeLock(buildLock(input())));
  });

  it('keeps vendoredOn from the previous lock when the pin is unchanged', () => {
    const previous = { tag: 'v23.1', commit: COMMIT, tarballSha256: TARBALL, vendoredOn: '2026-01-01' };
    expect(buildLock(input({ today: '2026-10-20', previous })).vendoredOn).toBe('2026-01-01');
  });

  it('uses today when the pin changed', () => {
    const previous = { tag: 'v23.0', commit: COMMIT, tarballSha256: TARBALL, vendoredOn: '2026-01-01' };
    expect(buildLock(input({ today: '2026-10-20', previous })).vendoredOn).toBe('2026-10-20');
  });
});

describe('serializeLock', () => {
  it('emits 2-space JSON with a trailing newline', () => {
    const text = serializeLock(buildLock(input()));
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "tag": "v23.1",\n');
  });
});
