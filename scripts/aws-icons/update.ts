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
import { appendFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLock, type IconLock } from '../../src/aws/icon-lock.ts';
import { CATEGORY_AGGREGATE, iconPathParts, isIconTag } from '../../src/aws/path-grammar.ts';
import { scanVendoredContent, type FileViolation, type SourceScanner } from '../../src/aws/vendored-scan.ts';
import { diffCatalog, formatReport, type CatalogDiff } from './catalog-diff.ts';
import { checkEquivalence } from './equivalence.ts';
import { extractMembers, listTarball, runTar, selectMembers, upstreamRoot, verifyExtracted, type TarRunner } from './extract.ts';
import { downloadTarball, resolveTagCommit, type UpstreamFetch } from './fetch.ts';
import { buildLock, serializeLock } from './lock.ts';

export const LOCK_FILE = 'aws-icons.lock.json';
export const ICONS_DIR = join('assets', 'aws-icons');

export interface UpdateDeps {
  readonly repoRoot: string;
  readonly fetchImpl: UpstreamFetch;
  readonly runTar: TarRunner;
  readonly scanner: SourceScanner;
  /** ISO date (YYYY-MM-DD). */
  readonly today: string;
  readonly tmpRoot?: string;
  readonly token?: string | undefined;
  /** Test seam for the promotion step (defaults to `fs.rename`). */
  readonly rename?: Rename;
}

export type UpdateOutcome =
  | {
      readonly ok: true;
      readonly lock: IconLock;
      readonly previous: IconLock | null;
      readonly vendoredBytes: number;
      readonly diff: CatalogDiff;
      /** Markdown report (PR body / job summary). */
      readonly report: string;
    }
  | { readonly ok: false; readonly violations: readonly FileViolation[] };

/** The previous lock through the shared contract guard; anything invalid counts as "no previous lock". */
export function readPreviousLock(text: string | null): IconLock | null {
  if (text === null) return null;
  try {
    return parseLock(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
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

type Rename = (from: string, to: string) => Promise<void>;

interface AtomicWrite {
  readonly repoRoot: string;
  readonly tag: string;
  readonly previousTag: string | null;
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly licenses: ReadonlyMap<string, Uint8Array>;
  readonly lockText: string;
}

/**
 * Stages the set and the lock inside the repo, then swaps them in. If the swap fails midway, the new
 * tag directory is removed and the previous one restored, so an interrupted run never leaves the lock
 * pointing at nothing (or a second tag directory behind). The original failure is always rethrown.
 */
async function writeAtomically(write: AtomicWrite, move: Rename): Promise<void> {
  const iconsDir = join(write.repoRoot, ICONS_DIR);
  await mkdir(iconsDir, { recursive: true });
  const nonce = randomBytes(6).toString('hex');
  const staging = join(iconsDir, `.staging-${nonce}`);
  const target = join(iconsDir, write.tag);
  const backup = join(iconsDir, `.previous-${nonce}`);
  const lockTmp = join(write.repoRoot, `.${LOCK_FILE}.${nonce}`);
  let hadTarget = false;
  let targetWritten = false;
  try {
    for (const [path, bytes] of [...write.files, ...write.licenses]) {
      const dest = join(staging, ...path.split('/'));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, bytes);
    }
    await writeFile(lockTmp, write.lockText);

    try {
      await move(target, backup);
      hadTarget = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await move(staging, target);
    targetWritten = true;
    await move(lockTmp, join(write.repoRoot, LOCK_FILE));
  } catch (error) {
    await rollBack({ target, backup, hadTarget, targetWritten, tag: write.tag }, move, error);
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(lockTmp, { force: true });
  }

  if (hadTarget) await rm(backup, { recursive: true, force: true });
  // One shipped release at a time (RN-07): drop the superseded tag directory. The tag comes from the
  // previous lock, so it is re-checked against the grammar before it is used in a path.
  if (write.previousTag !== null && write.previousTag !== write.tag && isIconTag(write.previousTag)) {
    await rm(join(iconsDir, write.previousTag), { recursive: true, force: true });
  }
}

interface RollBackState {
  readonly target: string;
  readonly backup: string;
  readonly hadTarget: boolean;
  readonly targetWritten: boolean;
  readonly tag: string;
}

async function rollBack(state: RollBackState, move: Rename, cause: unknown): Promise<void> {
  try {
    if (state.targetWritten || state.hadTarget) await rm(state.target, { recursive: true, force: true });
    if (state.hadTarget) await move(state.backup, state.target);
    console.error(`icons:update: promotion failed; ${state.hadTarget ? `restored the previous ${state.tag} set` : 'removed the partial set'}`);
  } catch (restoreError) {
    // Keep the original failure as the cause; the message tells the maintainer where the backup is.
    console.error(`icons:update: rollback failed; the previous set is kept at ${state.backup}`);
    throw new AggregateError([cause, restoreError], 'icons:update promotion and rollback both failed', { cause });
  }
}

export async function runUpdate(tag: string, deps: UpdateDeps): Promise<UpdateOutcome> {
  const work = await mkdtemp(join(deps.tmpRoot ?? tmpdir(), 'hd-aws-icons-'));
  try {
    const commit = await resolveTagCommit(tag, deps.fetchImpl, deps.token);
    const tarball = await downloadTarball(commit, deps.fetchImpl);
    const tarballPath = join(work, 'upstream.tar.gz');
    await writeFile(tarballPath, tarball.bytes);

    const selection = selectMembers(await listTarball(tarballPath, deps.runTar), upstreamRoot(commit));
    if (selection.violations.length > 0) return { ok: false, violations: selection.violations };

    const extractDir = join(work, 'extracted');
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
    await writeAtomically(
      {
        repoRoot: deps.repoRoot,
        tag,
        previousTag: previous?.tag ?? null,
        files: inspected.files,
        licenses,
        lockText: serializeLock(lock),
      },
      deps.rename ?? ((from, to) => rename(from, to)),
    );
    const vendoredBytes = lock.files.reduce((sum, f) => sum + f.bytes, 0);
    const diff = diffCatalog(previous?.files ?? null, lock.files);
    return { ok: true, lock, previous, vendoredBytes, diff, report: formatReport(diff, lock, previous) };
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

/** GitHub Actions hand-off: the report to the job summary, `breaking`/`tag` to the step outputs. */
export async function publishToGithub(
  env: Readonly<Record<string, string | undefined>>,
  report: string,
  diff: CatalogDiff,
  tag: string,
  append: (path: string, data: string) => Promise<void> = (path, data) => appendFile(path, data),
): Promise<void> {
  const summary = env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '') await append(summary, report);
  const output = env['GITHUB_OUTPUT'];
  if (output !== undefined && output !== '') await append(output, `breaking=${diff.breaking}\ntag=${tag}\n`);
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
    token: process.env['GITHUB_TOKEN'],
  });
  if (!outcome.ok) {
    console.error(`icons:update refused ${tag} — nothing was written:\n${formatViolations(outcome.violations)}`);
    return 1;
  }
  const { lock } = outcome;
  console.log(outcome.report);
  console.error(
    `icons:update ${lock.tag} (commit ${lock.commit}, tarball sha256 ${lock.tarballSha256}): ` +
      `${lock.files.length} files, ${outcome.vendoredBytes} bytes → ${lock.root}`,
  );
  await publishToGithub(process.env, outcome.report, outcome.diff, lock.tag);
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
