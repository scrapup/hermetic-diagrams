import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger, type LogFields } from '../logger.js';
import { parseLock, sha256Hex, type IconLock } from './icon-lock.js';

/**
 * Icon Set Store (`plan.md` §3.2, §4.7, D-06). At boot it reads `aws-icons.lock.json`, validates it
 * with the shared contract guard (`parseLock`, no new dependency, D-10), reads every listed file and compares its
 * sha256. The result is an **in-memory allowlist**: the resolver only ever does an exact `Map.get`
 * on it — Requester input never reaches the filesystem.
 *
 * A bad set never stops the gateway: it is reported `UNVERIFIED` (AWS includes are then refused with
 * `ICONS_UNAVAILABLE`) while every other notation keeps working.
 */

/** Re-exported so the store stays the single import for boot-time consumers. */
export { parseLock };

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
