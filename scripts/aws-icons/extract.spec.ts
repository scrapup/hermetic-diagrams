import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractMembers, listTarball, selectMembers, verifyExtracted, type TarRunner } from './extract.ts';

const R = 'aws-icons-for-plantuml-b788ba79';

describe('selectMembers', () => {
  it('selects dist icons and root licenses, ignoring everything else', () => {
    const selection = selectMembers([
      `${R}/`,
      `${R}/README.md`,
      `${R}/LICENSE`,
      `${R}/LICENSE-CODE`,
      `${R}/dist/`,
      `${R}/dist/AWSCommon.puml`,
      `${R}/dist/Compute/`,
      `${R}/dist/Compute/Lambda.puml`,
      `${R}/dist/Compute/Lambda.png`,
      `${R}/dist/Storage/all.puml`,
      `${R}/source/tool.py`,
    ]);
    expect(selection.violations).toEqual([]);
    expect(selection.root).toBe(R);
    expect(selection.icons).toEqual(['AWSCommon.puml', 'Compute/Lambda.puml', 'Storage/all.puml']);
    expect(selection.licenses).toEqual(['LICENSE', 'LICENSE-CODE']);
    expect(selection.members).toEqual([
      `${R}/LICENSE`,
      `${R}/LICENSE-CODE`,
      `${R}/dist/AWSCommon.puml`,
      `${R}/dist/Compute/Lambda.puml`,
      `${R}/dist/Storage/all.puml`,
    ]);
  });

  it.each([
    ['/etc/passwd', 'absolute_path'],
    ['C:/x/y.puml', 'absolute_path'],
    [`${R}/dist/../../evil.puml`, 'parent_segment'],
    [`${R}\\dist\\x.puml`, 'backslash'],
    [`${R}/dist/Compute/Sub/Deep.puml`, 'path_grammar'],
    [`${R}/dist/Compute/Bad-Name.puml`, 'path_grammar'],
    ['other-root/dist/X.puml', 'multiple_roots'],
  ])('flags %s as %s', (name, rule) => {
    const selection = selectMembers([`${R}/dist/AWSCommon.puml`, name]);
    expect(selection.violations).toEqual([{ file: name, rule, line: 0 }]);
    expect(selection.members).not.toContain(name);
  });

  it('flags duplicated entries', () => {
    const name = `${R}/dist/AWSCommon.puml`;
    expect(selectMembers([name, name]).violations).toEqual([{ file: name, rule: 'duplicate_entry', line: 0 }]);
  });

  it('flags an empty archive', () => {
    expect(selectMembers(['']).violations.map((v) => v.rule)).toEqual(['empty_archive']);
  });

  it('flags an archive with no icons', () => {
    expect(selectMembers([`${R}/README.md`]).violations.map((v) => v.rule)).toEqual(['no_icons']);
  });
});

describe('listTarball / extractMembers', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hd-extract-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lists names via tar -tzf', async () => {
    const run: TarRunner = vi.fn(() => Promise.resolve('a/\na/x.puml\r\n\n'));
    await expect(listTarball('/t.tgz', run)).resolves.toEqual(['a/', 'a/x.puml']);
    expect(run).toHaveBeenCalledWith(['-tzf', '/t.tgz']);
  });

  it('extracts only the explicit member list via tar -T', async () => {
    const run: TarRunner = vi.fn(() => Promise.resolve(''));
    const listFile = join(dir, 'members.txt');
    await extractMembers('/t.tgz', ['a/x.puml', 'a/LICENSE'], join(dir, 'out'), listFile, run);
    expect(run).toHaveBeenCalledWith(['-xzf', '/t.tgz', '-C', join(dir, 'out'), '-T', listFile]);
    await expect(readFile(listFile, 'utf8')).resolves.toBe('a/x.puml\na/LICENSE\n');
  });
});

describe('verifyExtracted', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hd-verify-'));
    await mkdir(join(dir, 'r/dist/Compute'), { recursive: true });
    await writeFile(join(dir, 'r/dist/Compute/Lambda.puml'), 'x');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes when exactly the expected regular files exist', async () => {
    await expect(verifyExtracted(dir, ['r/dist/Compute/Lambda.puml'])).resolves.toEqual([]);
  });

  // Creating symlinks needs elevated rights on Windows; the rule itself is platform-independent.
  it.skipIf(process.platform === 'win32')('flags a symlink entry', async () => {
    await symlink('/etc/hosts', join(dir, 'r/dist/Compute/S3.puml'));
    await expect(verifyExtracted(dir, ['r/dist/Compute/Lambda.puml', 'r/dist/Compute/S3.puml'])).resolves.toEqual([
      { file: 'r/dist/Compute/S3.puml', rule: 'symlink', line: 0 },
    ]);
  });

  it('flags unexpected and missing entries', async () => {
    await expect(verifyExtracted(dir, ['r/dist/AWSCommon.puml'])).resolves.toEqual([
      { file: 'r/dist/Compute/Lambda.puml', rule: 'unexpected_entry', line: 0 },
      { file: 'r/dist/AWSCommon.puml', rule: 'missing_after_extract', line: 0 },
    ]);
  });
});
