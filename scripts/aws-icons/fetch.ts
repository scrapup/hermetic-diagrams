/**
 * Maintainer-side download (`plan.md` §5.5 steps 1–2). Resolves an upstream tag to its commit and
 * downloads the commit-pinned tarball. Integrity anchor: TLS + commit-pinned URL + the tarball
 * sha256 recorded in the lock and reviewed in the PR (upstream does not sign releases).
 *
 * This runs only on the maintainer's machine / the update workflow — never in the MCP.
 */
import { ICON_UPSTREAM, sha256Hex } from '../../src/aws/icon-lock.ts';
import { isIconTag } from '../../src/aws/path-grammar.ts';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const API = `https://api.github.com/repos/${ICON_UPSTREAM}`;
const CODELOAD = `https://codeload.github.com/${ICON_UPSTREAM}/tar.gz`;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

export interface TarballDownload {
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

function headers(token: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'hermetic-diagrams-icons-update',
  };
  if (token !== undefined && token.length > 0) h.authorization = `Bearer ${token}`;
  return h;
}

interface GitObject {
  readonly type: string;
  readonly sha: string;
  readonly url: string;
}

function readGitObject(body: unknown): GitObject {
  if (typeof body !== 'object' || body === null) throw new Error('fetch: unexpected GitHub API response');
  const object: unknown = (body as { object?: unknown }).object;
  if (typeof object !== 'object' || object === null) throw new Error('fetch: GitHub API response has no object');
  const { type, sha, url } = object as { type?: unknown; sha?: unknown; url?: unknown };
  if (typeof type !== 'string' || typeof sha !== 'string' || typeof url !== 'string') {
    throw new Error('fetch: malformed git object in GitHub API response');
  }
  return { type, sha, url };
}

async function getJson(fetchImpl: FetchLike, url: string, token: string | undefined): Promise<unknown> {
  const res = await fetchImpl(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`fetch: GitHub API returned HTTP ${res.status} for ${url}`);
  const body: unknown = await res.json();
  return body;
}

/** Tag → 40-hex commit sha; dereferences annotated tags (one level, as git does for releases). */
export async function resolveTagCommit(tag: string, fetchImpl: FetchLike, token?: string): Promise<string> {
  if (!isIconTag(tag)) throw new Error(`fetch: invalid tag "${tag}" (expected v<major>[.<minor>…])`);
  let object = readGitObject(await getJson(fetchImpl, `${API}/git/ref/tags/${tag}`, token));
  if (object.type === 'tag') {
    const expected = `${API}/git/tags/${object.sha}`;
    if (!COMMIT_SHA.test(object.sha) || object.url !== expected) {
      throw new Error('fetch: annotated tag points outside the upstream repository');
    }
    object = readGitObject(await getJson(fetchImpl, expected, token));
  }
  if (object.type !== 'commit' || !COMMIT_SHA.test(object.sha)) {
    throw new Error(`fetch: tag "${tag}" does not resolve to a commit`);
  }
  return object.sha;
}

/** Downloads the commit-pinned tarball into memory and fingerprints it. */
export async function downloadTarball(commit: string, fetchImpl: FetchLike): Promise<TarballDownload> {
  if (!COMMIT_SHA.test(commit)) throw new Error('fetch: invalid commit sha');
  const res = await fetchImpl(`${CODELOAD}/${commit}`, { headers: { 'user-agent': 'hermetic-diagrams-icons-update' } });
  if (!res.ok) throw new Error(`fetch: tarball download returned HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, sha256: sha256Hex(bytes) };
}
