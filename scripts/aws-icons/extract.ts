/**
 * Restricted tarball extraction (`plan.md` §5.5 step 3). The tarball is untrusted data: names are
 * validated **before** extraction (single top-level dir, no absolute paths, no `..`, no backslash,
 * path grammar for icon files), only an explicit member list is extracted (`tar -T`, portable across
 * bsdtar and GNU tar), and the result is re-checked with `lstat` (no symlinks, nothing unexpected).
 * Nothing extracted is ever executed.
 */
import { execFile } from 'node:child_process';
import { lstat, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { isIconPath } from '../../src/aws/path-grammar.ts';
import type { FileViolation } from '../../src/aws/vendored-scan.ts';

/** Runs `tar` with the given arguments and resolves to its stdout. */
export type TarRunner = (args: readonly string[]) => Promise<string>;

const execFileAsync = promisify(execFile);

export const runTar: TarRunner = async (args) => {
  const { stdout } = await execFileAsync('tar', [...args], { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

const LICENSE_NAME = /^LICENSE(?:-[A-Z]+)?$/;

export interface MemberSelection {
  /** Archive members to extract (full names, as listed). */
  readonly members: readonly string[];
  /** Grammar-valid paths relative to `dist/` (includes upstream `all.puml`). */
  readonly icons: readonly string[];
  /** License file names at the archive root. */
  readonly licenses: readonly string[];
  /** Archive top-level directory. */
  readonly root: string;
  readonly violations: readonly FileViolation[];
}

/** codeload's top-level directory for a commit-pinned tarball. */
export function upstreamRoot(commit: string): string {
  return `aws-icons-for-plantuml-${commit}`;
}

function nameViolation(name: string): string | null {
  // `tar -T` reads list lines starting with '-' as options (CWE-88): never let one through.
  if (name.startsWith('-')) return 'option_like_name';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return 'absolute_path';
  if (name.includes('\\')) return 'backslash';
  if (name.split('/').includes('..')) return 'parent_segment';
  return null;
}

/**
 * Validates every archive name and picks `dist/**\/*.puml` + root `LICENSE*`. Every entry must live
 * under `expectedRoot` (the commit-pinned directory codeload generates).
 */
export function selectMembers(names: readonly string[], expectedRoot: string): MemberSelection {
  const violations: FileViolation[] = [];
  const members: string[] = [];
  const icons: string[] = [];
  const licenses: string[] = [];
  const seen = new Set<string>();
  let root: string | null = null;

  for (const name of names) {
    if (name.length === 0) continue;
    const bad = nameViolation(name);
    if (bad !== null) {
      violations.push({ file: name, rule: bad, line: 0 });
      continue;
    }
    if (seen.has(name)) {
      violations.push({ file: name, rule: 'duplicate_entry', line: 0 });
      continue;
    }
    seen.add(name);

    const top = name.split('/')[0] ?? '';
    if (top !== expectedRoot) {
      violations.push({ file: name, rule: 'unexpected_root', line: 0 });
      continue;
    }
    root = top;
    if (name.endsWith('/')) continue;

    const rest = name.slice(root.length + 1);
    if (rest.startsWith('dist/') && rest.endsWith('.puml')) {
      const rel = rest.slice('dist/'.length);
      if (!isIconPath(rel)) {
        violations.push({ file: name, rule: 'path_grammar', line: 0 });
        continue;
      }
      members.push(name);
      icons.push(rel);
    } else if (LICENSE_NAME.test(rest)) {
      members.push(name);
      licenses.push(rest);
    }
  }

  if (root === null) violations.push({ file: '(archive)', rule: 'empty_archive', line: 0 });
  if (icons.length === 0 && root !== null) violations.push({ file: '(archive)', rule: 'no_icons', line: 0 });
  return { members, icons, licenses, root: root ?? '', violations };
}

export async function listTarball(tarballPath: string, run: TarRunner): Promise<string[]> {
  const stdout = await run(['-tzf', tarballPath]);
  return stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

export async function extractMembers(
  tarballPath: string,
  members: readonly string[],
  destDir: string,
  listFile: string,
  run: TarRunner,
): Promise<void> {
  await writeFile(listFile, `${members.join('\n')}\n`);
  await run(['-xzf', tarballPath, '-C', destDir, '-T', listFile]);
}

async function walk(dir: string, out: string[]): Promise<void> {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const stat = await lstat(full);
    if (stat.isDirectory()) await walk(full, out);
    else out.push(full);
  }
}

/** Every extracted entry must be an expected regular file; every expected file must exist. */
export async function verifyExtracted(destDir: string, members: readonly string[]): Promise<FileViolation[]> {
  const violations: FileViolation[] = [];
  const expected = new Set(members);
  const found: string[] = [];
  await walk(destDir, found);
  const present = new Set<string>();
  for (const full of found) {
    const name = relative(destDir, full).split(sep).join('/');
    present.add(name);
    const stat = await lstat(full);
    if (stat.isSymbolicLink()) violations.push({ file: name, rule: 'symlink', line: 0 });
    else if (!stat.isFile()) violations.push({ file: name, rule: 'not_regular_file', line: 0 });
    else if (!expected.has(name)) violations.push({ file: name, rule: 'unexpected_entry', line: 0 });
  }
  for (const name of members) {
    if (!present.has(name)) violations.push({ file: name, rule: 'missing_after_extract', line: 0 });
  }
  return violations;
}
