import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ICON_LOCK_SCHEMA_VERSION,
  ICON_UPSTREAM,
  iconSetRoot,
  manifestSha256,
  sha256Hex,
  type IconLock,
  type IconLockFile,
} from './icon-lock.js';
import { logger, type LogFields } from '../logger.js';
import { CATEGORY_AGGREGATE, iconPathParts, isIconPath, isIconTag } from './path-grammar.js';

/**
 * Icon Set Store (`plan.md` §3.2, §4.7, D-06). At boot it reads `aws-icons.lock.json`, validates it
 * with hand-rolled guards (no new dependency, D-10), reads every listed file and compares its
 * sha256. The result is an **in-memory allowlist**: the resolver only ever does an exact `Map.get`
 * on it — Requester input never reaches the filesystem.
 *
 * A bad set never stops the gateway: it is reported `UNVERIFIED` (AWS includes are then refused with
 * `ICONS_UNAVAILABLE`) while every other notation keeps working.
 */

export type IconSetState = 'VERIFIED' | 'UNVERIFIED';
export type IconSetFailure = 'lock_invalid' | 'file_missing' | 'hash_mismatch';

export interface IconSet {
  readonly state: IconSetState;
  readonly reason?: IconSetFailure;
  /** Upstream tag in force; `null` when the lock itself could not be read. */
  readonly version: string | null;
  /** `AWSPuml/`-relative path → verified UTF-8 content. Empty unless `VERIFIED`. */
  readonly files: ReadonlyMap<string, string>;
  /** Category → icon paths in manifest order (drives the synthetic `<Category>/all.puml`). */
  readonly categories: ReadonlyMap<string, readonly string[]>;
  /** Files whose verification failed (count only — never names, RN-12). */
  readonly failedFiles: number;
}

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLockFile(value: unknown): IconLockFile | null {
  if (!isRecord(value)) return null;
  const { path: filePath, kind, category, name, sha256, bytes } = value;
  if (typeof filePath !== 'string' || !isIconPath(filePath)) return null;
  // The aggregate is synthesized, never shipped: a listed `all.puml` would shadow it.
  if (filePath === CATEGORY_AGGREGATE || filePath.endsWith(`/${CATEGORY_AGGREGATE}`)) return null;
  const parts = iconPathParts(filePath);
  if (kind !== parts.kind || category !== parts.category || name !== parts.name) return null;
  if (typeof sha256 !== 'string' || !HEX64.test(sha256)) return null;
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) return null;
  return { path: filePath, kind: parts.kind, category: parts.category, name: parts.name, sha256, bytes };
}

function deriveCategories(files: readonly IconLockFile[]): Map<string, string[]> {
  const categories = new Map<string, string[]>();
  for (const file of files) {
    if (file.category === null) continue;
    const list = categories.get(file.category) ?? [];
    list.push(file.name);
    categories.set(file.category, list);
  }
  return categories;
}

function sameCategories(declared: unknown, derived: ReadonlyMap<string, readonly string[]>): boolean {
  if (!isRecord(declared)) return false;
  const keys = Object.keys(declared);
  if (keys.length !== derived.size) return false;
  return keys.every((key) => {
    const names = declared[key];
    const expected = derived.get(key);
    return (
      Array.isArray(names) &&
      expected !== undefined &&
      names.length === expected.length &&
      names.every((n, i) => n === expected[i])
    );
  });
}

/** Validates the lock contract (`plan.md` §3.1). Any deviation → `null` (treated as `lock_invalid`). */
export function parseLock(value: unknown): IconLock | null {
  if (!isRecord(value)) return null;
  const { $schemaVersion, upstream, tag, commit, tarballSha256, vendoredOn, root, files, categories } = value;
  if ($schemaVersion !== ICON_LOCK_SCHEMA_VERSION || upstream !== ICON_UPSTREAM) return null;
  if (typeof tag !== 'string' || !isIconTag(tag)) return null;
  if (typeof commit !== 'string' || !HEX40.test(commit)) return null;
  if (typeof tarballSha256 !== 'string' || !HEX64.test(tarballSha256)) return null;
  if (typeof vendoredOn !== 'string' || !ISO_DATE.test(vendoredOn)) return null;
  if (root !== iconSetRoot(tag)) return null;
  if (!Array.isArray(files) || files.length === 0) return null;

  const parsed: IconLockFile[] = [];
  const seen = new Set<string>();
  for (const entry of files) {
    const file = parseLockFile(entry);
    if (file === null || seen.has(file.path)) return null;
    seen.add(file.path);
    parsed.push(file);
  }
  const manifest = manifestSha256(parsed);
  if (value.manifestSha256 !== manifest) return null;
  const derived = deriveCategories(parsed);
  if (!sameCategories(categories, derived)) return null;

  return {
    $schemaVersion: ICON_LOCK_SCHEMA_VERSION,
    upstream: ICON_UPSTREAM,
    tag,
    commit,
    tarballSha256,
    vendoredOn,
    root,
    files: parsed,
    categories: Object.fromEntries(derived),
    manifestSha256: manifest,
  };
}

function unverified(reason: IconSetFailure, version: string | null, failedFiles: number): IconSet {
  return { state: 'UNVERIFIED', reason, version, files: new Map(), categories: new Map(), failedFiles };
}

async function readLock(lockPath: string): Promise<IconLock | null> {
  try {
    return parseLock(JSON.parse(await readFile(lockPath, 'utf8')) as unknown);
  } catch {
    return null;
  }
}

/**
 * @param iconsRoot directory holding `<tag>/` (in the image: `/app/assets/aws-icons`)
 * @param lockPath  path of `aws-icons.lock.json`
 */
export async function loadIconSet(iconsRoot: string, lockPath: string): Promise<IconSet> {
  const lock = await readLock(lockPath);
  if (lock === null) return unverified('lock_invalid', null, 1);

  const setDir = path.join(iconsRoot, lock.tag);
  const files = new Map<string, string>();
  let missing = 0;
  let mismatched = 0;
  for (const file of lock.files) {
    // Paths were re-validated against the grammar by parseLock before reaching this fs call.
    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(setDir, ...file.path.split('/')));
    } catch {
      missing += 1;
      continue;
    }
    if (bytes.byteLength !== file.bytes || sha256Hex(bytes) !== file.sha256) {
      mismatched += 1;
      continue;
    }
    files.set(file.path, bytes.toString('utf8'));
  }
  if (missing > 0) return unverified('file_missing', lock.tag, missing + mismatched);
  if (mismatched > 0) return unverified('hash_mismatch', lock.tag, mismatched);

  const categories = new Map<string, readonly string[]>();
  for (const [category, names] of Object.entries(lock.categories)) {
    categories.set(category, names.map((name) => `${category}/${name}.puml`));
  }
  return { state: 'VERIFIED', version: lock.tag, files, categories, failedFiles: 0 };
}

/** `containment_status.awsIcons` (`plan.md` §4.7). */
export interface AwsIconsStatus {
  readonly state: 'verified' | 'unverified';
  readonly version: string | null;
  readonly reason?: IconSetFailure;
}

export function awsIconsStatus(iconSet: IconSet): AwsIconsStatus {
  return {
    state: iconSet.state === 'VERIFIED' ? 'verified' : 'unverified',
    version: iconSet.version,
    ...(iconSet.reason !== undefined ? { reason: iconSet.reason } : {}),
  };
}

type BootLogger = Pick<typeof logger, 'info' | 'warn'>;

/** Boot-time load with the `boot.aws_icons` event (`plan.md` §5.3): counts only, never names. */
export async function bootIconSet(iconsRoot: string, lockPath: string, log: BootLogger = logger): Promise<IconSet> {
  const started = performance.now();
  const set = await loadIconSet(iconsRoot, lockPath);
  const durationMs = Math.round(performance.now() - started);
  if (set.state === 'VERIFIED') {
    const fields: LogFields = { state: 'verified', version: set.version ?? undefined, files: set.files.size, durationMs };
    log.info('boot.aws_icons', fields);
  } else {
    log.warn('boot.aws_icons', { state: 'unverified', reason: set.reason, count: set.failedFiles, durationMs });
  }
  return set;
}
