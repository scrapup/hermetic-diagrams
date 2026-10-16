/**
 * Catalog difference between two locks (aws-icons `plan.md` §5.5 step 6, RN-10): what an update
 * adds and removes, plus informative rename candidates. Any removal is breaking, because diagrams
 * that include the removed file would stop rendering.
 */
import { compareCodePoints, type IconLock, type IconLockFile } from '../../src/aws/icon-lock.ts';

export interface RenameCandidate {
  readonly from: string;
  readonly to: string;
  /** Normalized, case-insensitive name similarity in [0, 1]. */
  readonly similarity: number;
}

export interface CatalogDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly renamedCandidates: readonly RenameCandidate[];
  readonly breaking: boolean;
}

export const RENAME_SIMILARITY = 0.8;

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export function nameSimilarity(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const longest = Math.max(x.length, y.length);
  return longest === 0 ? 1 : 1 - levenshtein(x, y) / longest;
}

function byPath(files: readonly IconLockFile[]): Map<string, IconLockFile> {
  return new Map(files.map((f) => [f.path, f]));
}

export function diffCatalog(previous: readonly IconLockFile[] | null, next: readonly IconLockFile[]): CatalogDiff {
  const before = byPath(previous ?? []);
  const after = byPath(next);
  const added = [...after.keys()].filter((p) => !before.has(p)).sort(compareCodePoints);
  const removed = [...before.keys()].filter((p) => !after.has(p)).sort(compareCodePoints);

  const renamedCandidates: RenameCandidate[] = [];
  const claimed = new Set<string>();
  for (const from of removed) {
    const old = before.get(from);
    if (old === undefined) continue;
    let best: RenameCandidate | null = null;
    for (const to of added) {
      const fresh = after.get(to);
      if (fresh === undefined || claimed.has(to) || fresh.category !== old.category) continue;
      const similarity = nameSimilarity(old.name, fresh.name);
      if (similarity >= RENAME_SIMILARITY && (best === null || similarity > best.similarity)) {
        best = { from, to, similarity: Math.round(similarity * 100) / 100 };
      }
    }
    if (best !== null) {
      claimed.add(best.to);
      renamedCandidates.push(best);
    }
  }

  return { added, removed, renamedCandidates, breaking: removed.length > 0 };
}

function totalBytes(lock: Pick<IconLock, 'files'> | null): number {
  return (lock?.files ?? []).reduce((sum, f) => sum + f.bytes, 0);
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function list(title: string, items: readonly string[]): string[] {
  if (items.length === 0) return [`### ${title} (0)`, '', 'None.', ''];
  return [`### ${title} (${items.length})`, '', ...items.map((i) => `- \`${i}\``), ''];
}

/** Markdown used as the update PR body and the job summary. */
export function formatReport(diff: CatalogDiff, lock: IconLock, previous: IconLock | null): string {
  const bytes = totalBytes(lock);
  const previousBytes = totalBytes(previous);
  const lines = [
    `## AWS icons update: ${previous?.tag ?? '(none)'} → ${lock.tag}`,
    '',
    '| Field | Value |',
    '|---|---|',
    `| Upstream | \`${lock.upstream}\` |`,
    `| Tag | \`${lock.tag}\` |`,
    `| Commit | \`${lock.commit}\` |`,
    `| Tarball sha256 | \`${lock.tarballSha256}\` |`,
    `| Files | ${lock.files.length} (${signed(lock.files.length - (previous?.files.length ?? 0))}) |`,
    `| Size | ${bytes} bytes (${signed(bytes - previousBytes)}) |`,
    `| Breaking | ${diff.breaking ? '**yes** — icons removed' : 'no'} |`,
    '',
    ...list('Added', diff.added),
    ...list('Removed', diff.removed),
    '### Rename candidates (informative)',
    '',
    ...(diff.renamedCandidates.length === 0
      ? ['None.']
      : diff.renamedCandidates.map((r) => `- \`${r.from}\` → \`${r.to}\` (similarity ${r.similarity})`)),
    '',
    'Promotion requires the containment, golden, integration and guide-example jobs to pass and a human merge.',
  ];
  return `${lines.join('\n')}\n`;
}
