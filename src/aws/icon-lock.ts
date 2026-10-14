/**
 * `aws-icons.lock.json` contract (`plan.md` §3.1): the pinned upstream release plus a per-file
 * integrity manifest. Written by the maintainer update script, verified by the Icon Set Store at
 * every boot. The canonical form of `files` (sorted by path, fixed key order) is what
 * `manifestSha256` covers, so the writer and the verifier must share this module.
 *
 * Dependency-free apart from `node:crypto`, so the update script can import it under Node's native
 * type stripping.
 */
import { createHash } from 'node:crypto';
import type { IconKind } from './path-grammar.js';

export const ICON_LOCK_SCHEMA_VERSION = 1;
export const ICON_UPSTREAM = 'awslabs/aws-icons-for-plantuml';

export interface IconLockFile {
  readonly path: string;
  readonly kind: IconKind;
  /** `null` for base (root) files. */
  readonly category: string | null;
  readonly name: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface IconLock {
  readonly $schemaVersion: typeof ICON_LOCK_SCHEMA_VERSION;
  readonly upstream: typeof ICON_UPSTREAM;
  readonly tag: string;
  readonly commit: string;
  readonly tarballSha256: string;
  readonly vendoredOn: string;
  readonly root: string;
  readonly files: readonly IconLockFile[];
  /** category → icon names in manifest order (drives the synthetic `<Category>/all.puml`). */
  readonly categories: Readonly<Record<string, readonly string[]>>;
  readonly manifestSha256: string;
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Code-point ordering: locale-independent, so every machine produces the same lock. */
export function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Canonical JSON of `files`: sorted by path, keys in a fixed order. */
export function canonicalFilesJson(files: readonly IconLockFile[]): string {
  const ordered = [...files]
    .sort((a, b) => compareCodePoints(a.path, b.path))
    .map((f) => ({
      path: f.path,
      kind: f.kind,
      category: f.category,
      name: f.name,
      sha256: f.sha256,
      bytes: f.bytes,
    }));
  return JSON.stringify(ordered);
}

export function manifestSha256(files: readonly IconLockFile[]): string {
  return sha256Hex(canonicalFilesJson(files));
}

export function iconSetRoot(tag: string): string {
  return `assets/aws-icons/${tag}`;
}
