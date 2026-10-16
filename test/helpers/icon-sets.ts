import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIconSet, type IconSet } from '../../src/aws/icon-set-store.js';

/** In-memory icon sets for unit tests (no filesystem). */

export const UNVERIFIED_ICON_SET: IconSet = {
  state: 'UNVERIFIED',
  reason: 'hash_mismatch',
  version: 'v23.1',
  files: new Map(),
  categories: new Map(),
  failedFiles: 1,
};

/** Builds a `VERIFIED` set from `path → content`; categories follow the given order. */
export function verifiedIconSet(files: Readonly<Record<string, string>>, version = 'v23.1'): IconSet {
  const categories = new Map<string, string[]>();
  for (const filePath of Object.keys(files)) {
    const slash = filePath.indexOf('/');
    if (slash === -1) continue;
    const category = filePath.slice(0, slash);
    categories.set(category, [...(categories.get(category) ?? []), filePath]);
  }
  return { state: 'VERIFIED', version, files: new Map(Object.entries(files)), categories, failedFiles: 0 };
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let shipped: Promise<IconSet> | undefined;

/** The real shipped set from `assets/aws-icons` (loaded once per test file). */
export function shippedIconSet(): Promise<IconSet> {
  shipped ??= loadIconSet(path.join(REPO_ROOT, 'assets', 'aws-icons'), path.join(REPO_ROOT, 'aws-icons.lock.json'));
  return shipped;
}
