/**
 * Maintainer update script (`plan.md` §5.5): `npm run icons:update -- <tag>`.
 *
 * Turns an upstream tag into a verified vendored set + `aws-icons.lock.json`:
 * resolve tag → download commit-pinned tarball → restricted extract → strict vendored scan + shipped
 * `scanSecurity` → `all.puml` equivalence → write. Any violation exits non-zero with `file + rule`
 * and writes **nothing** under `assets/` (staged inside the repo, then atomically renamed).
 *
 * Runs under Node 24's native type stripping. The shipped scanner is loaded from `dist/` (the npm
 * script builds first), so the script checks exactly the code the MCP runs.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORY_AGGREGATE, iconPathParts } from '../../src/aws/path-grammar.ts';
import type { IconLock } from '../../src/aws/icon-lock.ts';
import { checkEquivalence } from './equivalence.ts';
import { extractMembers, listTarball, runTar, selectMembers, verifyExtracted, type TarRunner } from './extract.ts';
import { downloadTarball, resolveTagCommit, type FetchLike } from './fetch.ts';
import { buildLock, serializeLock } from './lock.ts';
import { scanVendoredContent, type FileViolation, type SourceScanner } from './vendored-scan.ts';

export const LOCK_FILE = 'aws-icons.lock.json';
export const ICONS_DIR = join('assets', 'aws-icons');

export interface UpdateDeps {
  readonly repoRoot: string;
  readonly fetchImpl: FetchLike;
  readonly runTar: TarRunner;
  readonly scanner: SourceScanner;
  /** ISO date (YYYY-MM-DD). */
  readonly today: string;
  readonly tmpRoot?: string;
  readonly token?: string | undefined;
}

export type UpdateOutcome =
  | { readonly ok: true; readonly lock: IconLock; readonly previous: IconLock | null; readonly vendoredBytes: number }
  | { readonly ok: false; readonly violations: readonly FileViolation[] };

/** Minimal guard for the previous lock: only what the update needs (full validation is the store's). */
export function readPreviousLock(text: string | null): IconLock | null {
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { tag, commit, tarballSha256, vendoredOn, files } = parsed as Record<string, unknown>;
  if (
    typeof tag !== 'string' ||
    typeof commit !== 'string' ||
    typeof tarballSha256 !== 'string' ||
    typeof vendoredOn !== 'string' ||
    !Array.isArray(files)
  ) {
    return null;
  }
  return parsed as IconLock;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

const UTF8 = new TextDecoder('utf-8', { fatal: true });

function decode(file: string, bytes: Uint8Array, violations: FileViolation[]): string | null {
  try {
    return UTF8.decode(bytes);
  } catch {
    violations.push({ file, rule: 'encoding: not valid UTF-8', line: 0 });
    return null;
  }
}

interface InspectedSet {
  readonly files: Map<string, Uint8Array>;
  readonly violations: FileViolation[];
}

/** Scans every icon file and proves `all.puml` equivalence; aggregates are checked but never shipped. */
export function inspectIconFiles(raw: ReadonlyMap<string, Uint8Array>, scanner: SourceScanner): InspectedSet {
  const violations: FileViolation[] = [];
  const files = new Map<string, Uint8Array>();
  const aggregates = new Map<string, string>();
  const members = new Map<string, string[]>();

  for (const [path, bytes] of raw) {
    const text = decode(path, bytes, violations);
    if (text === null) continue;
    const parts = iconPathParts(path);
    if (path.endsWith(`/${CATEGORY_AGGREGATE}`) && parts.category !== null) {
      aggregates.set(parts.category, text);
      continue;
    }
    if (path === CATEGORY_AGGREGATE) {
      violations.push({ file: path, rule: 'unexpected_root_aggregate', line: 0 });
      continue;
    }
    violations.push(...scanVendoredContent(path, text, scanner));
    files.set(path, bytes);
    if (parts.category !== null) {
      const list = members.get(parts.category) ?? [];
      list.push(text);
      members.set(parts.category, list);
    }
  }
  violations.push(...checkEquivalence(aggregates, members));
  return { files, violations };
}

async function writeAtomically(
  repoRoot: string,
  tag: string,
  files: ReadonlyMap<string, Uint8Array>,
  licenses: ReadonlyMap<string, Uint8Array>,
  lockText: string,
): Promise<void> {
  const iconsDir = join(repoRoot, ICONS_DIR);
  await mkdir(iconsDir, { recursive: true });
  const nonce = randomBytes(6).toString('hex');
  const staging = join(iconsDir, `.staging-${nonce}`);
  const target = join(iconsDir, tag);
  const backup = join(iconsDir, `.previous-${nonce}`);
  try {
    for (const [path, bytes] of [...files, ...licenses]) {
      const dest = join(staging, ...path.split('/'));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, bytes);
    }
    const lockTmp = join(repoRoot, `.${LOCK_FILE}.${nonce}`);
    await writeFile(lockTmp, lockText);

    let hadTarget = true;
    try {
      await rename(target, backup);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      hadTarget = false;
    }
    await rename(staging, target);
    await rename(lockTmp, join(repoRoot, LOCK_FILE));
    if (hadTarget) await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(join(repoRoot, `.${LOCK_FILE}.${nonce}`), { force: true });
  }
}

export async function runUpdate(tag: string, deps: UpdateDeps): Promise<UpdateOutcome> {
  const work = await mkdtemp(join(deps.tmpRoot ?? tmpdir(), 'hd-aws-icons-'));
  try {
    const commit = await resolveTagCommit(tag, deps.fetchImpl, deps.token);
    const tarball = await downloadTarball(commit, deps.fetchImpl);
    const tarballPath = join(work, 'upstream.tar.gz');
    await writeFile(tarballPath, tarball.bytes);

    const selection = selectMembers(await listTarball(tarballPath, deps.runTar));
    if (selection.violations.length > 0) return { ok: false, violations: selection.violations };

    const extractDir = join(work, 'x');
    await mkdir(extractDir);
    await extractMembers(tarballPath, selection.members, extractDir, join(work, 'members.txt'), deps.runTar);
    const extractViolations = await verifyExtracted(extractDir, selection.members);
    if (extractViolations.length > 0) return { ok: false, violations: extractViolations };

    const raw = new Map<string, Uint8Array>();
    for (const rel of selection.icons) {
      raw.set(rel, await readFile(join(extractDir, selection.root, 'dist', ...rel.split('/'))));
    }
    const inspected = inspectIconFiles(raw, deps.scanner);
    if (inspected.violations.length > 0) return { ok: false, violations: inspected.violations };

    const licenses = new Map<string, Uint8Array>();
    for (const name of selection.licenses) {
      licenses.set(name, await readFile(join(extractDir, selection.root, name)));
    }

    const previous = readPreviousLock(await readOptional(join(deps.repoRoot, LOCK_FILE)));
    const lock = buildLock({
      tag,
      commit,
      tarballSha256: tarball.sha256,
      today: deps.today,
      files: inspected.files,
      previous: previous ?? undefined,
    });
    await writeAtomically(deps.repoRoot, tag, inspected.files, licenses, serializeLock(lock));
    const vendoredBytes = lock.files.reduce((sum, f) => sum + f.bytes, 0);
    return { ok: true, lock, previous, vendoredBytes };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

type ScanSecurity = (format: string, source: string, maxSourceBytes: number) => void;

/** Loads the **built** shipped scanner, bound to the `plantuml` notation with no size cap. */
export async function loadShippedScanner(repoRoot: string): Promise<SourceScanner> {
  const href = pathToFileURL(join(repoRoot, 'dist', 'pep', 'security-scanner.js')).href;
  const mod: unknown = await import(href);
  const scan: unknown = typeof mod === 'object' && mod !== null ? (mod as { scanSecurity?: unknown }).scanSecurity : null;
  if (typeof scan !== 'function') throw new Error('dist/pep/security-scanner.js has no scanSecurity — run `npm run build`');
  const scanSecurity = scan as ScanSecurity;
  return (source) => scanSecurity('plantuml', source, Number.MAX_SAFE_INTEGER);
}

export function formatViolations(violations: readonly FileViolation[]): string {
  return violations.map((v) => `${v.file}${v.line > 0 ? `:${v.line}` : ''}  ${v.rule}`).join('\n');
}

async function main(argv: readonly string[]): Promise<number> {
  const tag = argv[0];
  if (tag === undefined) {
    console.error('usage: npm run icons:update -- <tag>   (e.g. v23.1)');
    return 2;
  }
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  const outcome = await runUpdate(tag, {
    repoRoot,
    fetchImpl: (url, init) => fetch(url, init),
    runTar,
    scanner: await loadShippedScanner(repoRoot),
    today: new Date().toISOString().slice(0, 10),
    token: process.env.GITHUB_TOKEN,
  });
  if (!outcome.ok) {
    console.error(`icons:update refused ${tag} — nothing was written:\n${formatViolations(outcome.violations)}`);
    return 1;
  }
  const { lock } = outcome;
  console.log(
    `icons:update ${lock.tag} (commit ${lock.commit}, tarball sha256 ${lock.tarballSha256}): ` +
      `${lock.files.length} files, ${outcome.vendoredBytes} bytes → ${lock.root}`,
  );
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(`icons:update failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    },
  );
}
