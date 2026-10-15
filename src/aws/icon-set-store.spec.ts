import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLock, serializeLock } from '../../scripts/aws-icons/lock.ts';
import { manifestSha256, type IconLock } from './icon-lock.js';
import { awsIconsStatus, bootIconSet, loadIconSet, parseLock } from './icon-set-store.js';

const FILES: Record<string, string> = {
  'AWSCommon.puml': '!define AWSEntity(a) a\n',
  'Compute/Lambda.puml': 'sprite $Lambda [1x1/16z] {\nx\n}\n',
  'Compute/EC2.puml': 'sprite $EC2 [1x1/16z] {\nx\n}\n',
  'Groups/VPC.puml': '!define VPCGroup(a) G(a)\n',
};

function makeLock(): IconLock {
  return buildLock({
    tag: 'v23.1',
    commit: 'b788ba79e8cd028be274761f0fadd8bf3b711acd',
    tarballSha256: 'c'.repeat(64),
    today: '2026-10-14',
    files: new Map(Object.entries(FILES).map(([p, c]) => [p, new TextEncoder().encode(c)])),
  });
}

describe('loadIconSet', () => {
  let dir: string;
  let iconsRoot: string;
  let lockPath: string;

  async function writeSet(lock: unknown = makeLock()): Promise<void> {
    for (const [rel, content] of Object.entries(FILES)) {
      const target = path.join(iconsRoot, 'v23.1', ...rel.split('/'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    await writeFile(lockPath, typeof lock === 'string' ? lock : serializeLock(lock as IconLock));
  }

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'hd-store-'));
    iconsRoot = path.join(dir, 'assets', 'aws-icons');
    lockPath = path.join(dir, 'aws-icons.lock.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('verifies a valid set into an in-memory allowlist', async () => {
    await writeSet();
    const set = await loadIconSet(iconsRoot, lockPath);
    expect(set.state).toBe('VERIFIED');
    expect(set.reason).toBeUndefined();
    expect(set.version).toBe('v23.1');
    expect([...set.files.keys()]).toEqual(['AWSCommon.puml', 'Compute/EC2.puml', 'Compute/Lambda.puml', 'Groups/VPC.puml']);
    expect(set.files.get('Compute/Lambda.puml')).toBe(FILES['Compute/Lambda.puml']);
    expect(Object.fromEntries(set.categories)).toEqual({
      Compute: ['Compute/EC2.puml', 'Compute/Lambda.puml'],
      Groups: ['Groups/VPC.puml'],
    });
  });

  it('reports lock_invalid when the lock is missing', async () => {
    const set = await loadIconSet(iconsRoot, lockPath);
    expect(set).toMatchObject({ state: 'UNVERIFIED', reason: 'lock_invalid', version: null });
    expect(set.files.size).toBe(0);
  });

  it('reports lock_invalid when the lock is not JSON', async () => {
    await writeSet('{ not json');
    await expect(loadIconSet(iconsRoot, lockPath)).resolves.toMatchObject({ reason: 'lock_invalid' });
  });

  it('reports file_missing when a listed file is absent', async () => {
    await writeSet();
    await unlink(path.join(iconsRoot, 'v23.1', 'Compute', 'EC2.puml'));
    const set = await loadIconSet(iconsRoot, lockPath);
    expect(set).toMatchObject({ state: 'UNVERIFIED', reason: 'file_missing', version: 'v23.1', failedFiles: 1 });
    expect(set.files.size).toBe(0);
  });

  it('reports hash_mismatch when a file was tampered with', async () => {
    await writeSet();
    await writeFile(path.join(iconsRoot, 'v23.1', 'AWSCommon.puml'), '!define AWSEntity(a) b\n');
    const set = await loadIconSet(iconsRoot, lockPath);
    expect(set).toMatchObject({ state: 'UNVERIFIED', reason: 'hash_mismatch', failedFiles: 1 });
    expect(set.files.size).toBe(0);
  });

  it('reports hash_mismatch when only the size differs from the lock', async () => {
    const lock = makeLock();
    const files = lock.files.map((f) => (f.path === 'AWSCommon.puml' ? { ...f, bytes: f.bytes + 1 } : f));
    const patched = buildLockLike(lock, files);
    await writeSet(patched);
    await expect(loadIconSet(iconsRoot, lockPath)).resolves.toMatchObject({ reason: 'hash_mismatch' });
  });

  it('verifies the real shipped set (v23.1)', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const set = await loadIconSet(path.join(root, 'assets', 'aws-icons'), path.join(root, 'aws-icons.lock.json'));
    expect(set.state).toBe('VERIFIED');
    expect(set.version).toBe('v23.1');
    expect(set.files.size).toBe(831);
    expect(set.categories.get('Storage')).toContain('Storage/SimpleStorageService.puml');
  });
});

/** Rebuilds a lock with patched files and a matching manifestSha256 (to reach the file checks). */
function buildLockLike(lock: IconLock, files: IconLock['files']): IconLock {
  return { ...lock, files, manifestSha256: manifestSha256(files) };
}

describe('parseLock', () => {
  const valid = (): Record<string, unknown> => JSON.parse(serializeLock(makeLock())) as Record<string, unknown>;

  it('accepts a lock produced by the update script', () => {
    expect(parseLock(valid())).not.toBeNull();
  });

  it.each([
    ['not an object', () => 'x'],
    ['array', () => []],
    ['schema version', () => ({ ...valid(), $schemaVersion: 2 })],
    ['upstream', () => ({ ...valid(), upstream: 'evil/fork' })],
    ['tag grammar', () => ({ ...valid(), tag: '../v1' })],
    ['commit', () => ({ ...valid(), commit: 'abc' })],
    ['tarball sha', () => ({ ...valid(), tarballSha256: 'abc' })],
    ['vendoredOn', () => ({ ...valid(), vendoredOn: 'yesterday' })],
    ['root mismatch', () => ({ ...valid(), root: 'assets/aws-icons/v1' })],
    ['files empty', () => ({ ...valid(), files: [] })],
    ['files not array', () => ({ ...valid(), files: {} })],
    ['manifest', () => ({ ...valid(), manifestSha256: 'f'.repeat(64) })],
    ['categories', () => ({ ...valid(), categories: { Compute: ['Lambda'] } })],
    ['categories not object', () => ({ ...valid(), categories: [] })],
  ])('rejects %s', (_label, make) => {
    expect(parseLock(make())).toBeNull();
  });

  function withFile(patch: Record<string, unknown>, index = 0): Record<string, unknown> {
    const lock = valid();
    const files = (lock.files as Record<string, unknown>[]).map((f, i) => (i === index ? { ...f, ...patch } : f));
    return { ...lock, files, manifestSha256: manifestSha256(files as unknown as IconLock['files']) };
  }

  it.each([
    ['path escape', { path: '../AWSCommon.puml' }],
    ['path depth', { path: 'A/B/C.puml' }],
    ['listed aggregate', { path: 'all.puml', name: 'all' }],
    ['kind mismatch', { kind: 'icon' }],
    ['category mismatch', { category: 'Compute' }],
    ['name mismatch', { name: 'Other' }],
    ['sha256', { sha256: 'xyz' }],
    ['bytes negative', { bytes: -1 }],
    ['bytes fractional', { bytes: 1.5 }],
  ])('rejects a file entry with bad %s', (_label, patch) => {
    expect(parseLock(withFile(patch))).toBeNull();
  });

  it('rejects a listed category aggregate', () => {
    const lock = valid();
    const files = lock.files as Record<string, unknown>[];
    const idx = files.findIndex((f) => f.path === 'Compute/EC2.puml');
    expect(parseLock(withFile({ path: 'Compute/all.puml', name: 'all' }, idx))).toBeNull();
  });

  it('rejects a non-object file entry', () => {
    const lock = valid();
    expect(parseLock({ ...lock, files: ['x'] })).toBeNull();
  });

  it('rejects duplicate paths', () => {
    const lock = valid();
    const files = lock.files as unknown[];
    const dup = [files[0], ...files];
    expect(parseLock({ ...lock, files: dup, manifestSha256: manifestSha256(dup as IconLock['files']) })).toBeNull();
  });
});

describe('awsIconsStatus', () => {
  it('reports verified with the version and no reason', () => {
    expect(
      awsIconsStatus({ state: 'VERIFIED', version: 'v23.1', files: new Map(), categories: new Map(), failedFiles: 0 }),
    ).toEqual({ state: 'verified', version: 'v23.1' });
  });

  it('reports unverified with the reason', () => {
    expect(
      awsIconsStatus({
        state: 'UNVERIFIED',
        reason: 'hash_mismatch',
        version: 'v23.1',
        files: new Map(),
        categories: new Map(),
        failedFiles: 2,
      }),
    ).toEqual({ state: 'unverified', version: 'v23.1', reason: 'hash_mismatch' });
  });
});


describe('bootIconSet', () => {
  it('logs boot.aws_icons info with counts and duration only', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const log = { info: vi.fn(), warn: vi.fn() };
    const set = await bootIconSet(path.join(root, 'assets', 'aws-icons'), path.join(root, 'aws-icons.lock.json'), log);
    expect(set.state).toBe('VERIFIED');
    expect(log.info).toHaveBeenCalledWith('boot.aws_icons', {
      state: 'verified',
      version: 'v23.1',
      files: 831,
      durationMs: expect.any(Number) as number,
    });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('logs boot.aws_icons warn with the reason and count, never a path', async () => {
    const log = { info: vi.fn(), warn: vi.fn() };
    await bootIconSet('/nonexistent/icons', '/nonexistent/aws-icons.lock.json', log);
    expect(log.warn).toHaveBeenCalledWith('boot.aws_icons', {
      state: 'unverified',
      reason: 'lock_invalid',
      count: 1,
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain('nonexistent');
  });
});
