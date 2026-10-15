/**
 * Builds the canonical `aws-icons.lock.json` (`plan.md` §3.1) from the verified file set.
 * Deterministic: same inputs → byte-identical output (files sorted by code point, fixed key order,
 * `vendoredOn` kept from the previous lock when the pin is unchanged).
 */
import {
  ICON_LOCK_SCHEMA_VERSION,
  ICON_UPSTREAM,
  compareCodePoints,
  deriveCategories,
  iconSetRoot,
  manifestSha256,
  sha256Hex,
  type IconLock,
  type IconLockFile,
} from '../../src/aws/icon-lock.ts';
import { iconPathParts } from '../../src/aws/path-grammar.ts';

export interface LockInput {
  readonly tag: string;
  readonly commit: string;
  readonly tarballSha256: string;
  /** ISO date (YYYY-MM-DD) used when the pin changed. */
  readonly today: string;
  /** Vendored files (grammar-valid relative path → bytes); `all.puml` already excluded. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly previous?: Pick<IconLock, 'tag' | 'commit' | 'tarballSha256' | 'vendoredOn'> | undefined;
}

export function buildLock(input: LockInput): IconLock {
  const files: IconLockFile[] = [...input.files.entries()]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([path, bytes]) => {
      const parts = iconPathParts(path);
      return {
        path,
        kind: parts.kind,
        category: parts.category,
        name: parts.name,
        sha256: sha256Hex(bytes),
        bytes: bytes.byteLength,
      };
    });

  const derived = deriveCategories(files);
  const sortedCategories = Object.fromEntries([...derived].sort(([a], [b]) => compareCodePoints(a, b)));

  const previous = input.previous;
  const samePin =
    previous !== undefined &&
    previous.tag === input.tag &&
    previous.commit === input.commit &&
    previous.tarballSha256 === input.tarballSha256;

  return {
    $schemaVersion: ICON_LOCK_SCHEMA_VERSION,
    upstream: ICON_UPSTREAM,
    tag: input.tag,
    commit: input.commit,
    tarballSha256: input.tarballSha256,
    vendoredOn: samePin ? previous.vendoredOn : input.today,
    root: iconSetRoot(input.tag),
    files,
    categories: sortedCategories,
    manifestSha256: manifestSha256(files),
  };
}

export function serializeLock(lock: IconLock): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}
