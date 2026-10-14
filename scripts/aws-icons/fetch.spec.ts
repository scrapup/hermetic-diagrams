import { describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../src/aws/icon-lock.ts';
import { downloadTarball, resolveTagCommit, type FetchLike } from './fetch.ts';

const COMMIT = 'b788ba79e8cd028be274761f0fadd8bf3b711acd';
const TAG_OBJECT = 'a'.repeat(40);
const API = 'https://api.github.com/repos/awslabs/aws-icons-for-plantuml';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function routes(table: Record<string, Response>): FetchLike & ReturnType<typeof vi.fn> {
  return vi.fn((url: string) => {
    const res = table[url];
    return Promise.resolve(res ?? new Response('not found', { status: 404 }));
  });
}

describe('resolveTagCommit', () => {
  it('returns the commit of a lightweight tag', async () => {
    const fetchImpl = routes({
      [`${API}/git/ref/tags/v23.1`]: json({ object: { type: 'commit', sha: COMMIT, url: 'x' } }),
    });
    await expect(resolveTagCommit('v23.1', fetchImpl)).resolves.toBe(COMMIT);
  });

  it('dereferences an annotated tag to its commit', async () => {
    const fetchImpl = routes({
      [`${API}/git/ref/tags/v23.1`]: json({
        object: { type: 'tag', sha: TAG_OBJECT, url: `${API}/git/tags/${TAG_OBJECT}` },
      }),
      [`${API}/git/tags/${TAG_OBJECT}`]: json({ object: { type: 'commit', sha: COMMIT, url: 'x' } }),
    });
    await expect(resolveTagCommit('v23.1', fetchImpl)).resolves.toBe(COMMIT);
  });

  it('refuses an annotated tag whose url points elsewhere', async () => {
    const fetchImpl = routes({
      [`${API}/git/ref/tags/v23.1`]: json({
        object: { type: 'tag', sha: TAG_OBJECT, url: `https://evil.example/git/tags/${TAG_OBJECT}` },
      }),
    });
    await expect(resolveTagCommit('v23.1', fetchImpl)).rejects.toThrow('outside the upstream repository');
  });

  it('refuses an invalid tag before any request', async () => {
    const fetchImpl = routes({});
    await expect(resolveTagCommit('v23.1/../../x', fetchImpl)).rejects.toThrow('invalid tag');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a non-commit object', async () => {
    const fetchImpl = routes({
      [`${API}/git/ref/tags/v23.1`]: json({ object: { type: 'tree', sha: COMMIT, url: 'x' } }),
    });
    await expect(resolveTagCommit('v23.1', fetchImpl)).rejects.toThrow('does not resolve to a commit');
  });

  it('refuses a malformed sha', async () => {
    const fetchImpl = routes({
      [`${API}/git/ref/tags/v23.1`]: json({ object: { type: 'commit', sha: 'ZZZ', url: 'x' } }),
    });
    await expect(resolveTagCommit('v23.1', fetchImpl)).rejects.toThrow('does not resolve to a commit');
  });

  it.each([[null], [{}], [{ object: { type: 1 } }]])('refuses a malformed API body %j', async (body) => {
    const fetchImpl = routes({ [`${API}/git/ref/tags/v23.1`]: json(body) });
    await expect(resolveTagCommit('v23.1', fetchImpl)).rejects.toThrow(/fetch:/);
  });

  it('surfaces HTTP errors', async () => {
    await expect(resolveTagCommit('v99', routes({}))).rejects.toThrow('HTTP 404');
  });

  it('sends a bearer token when provided', async () => {
    const fetchImpl = routes({
      [`${API}/git/ref/tags/v23.1`]: json({ object: { type: 'commit', sha: COMMIT, url: 'x' } }),
    });
    await resolveTagCommit('v23.1', fetchImpl, 'tkn');
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tkn');
  });
});

describe('downloadTarball', () => {
  it('downloads the commit-pinned codeload URL and fingerprints it', async () => {
    const fetchImpl = routes({
      [`https://codeload.github.com/awslabs/aws-icons-for-plantuml/tar.gz/${COMMIT}`]: new Response('tarball-bytes'),
    });
    const result = await downloadTarball(COMMIT, fetchImpl);
    expect(new TextDecoder().decode(result.bytes)).toBe('tarball-bytes');
    expect(result.sha256).toBe(sha256Hex('tarball-bytes'));
  });

  it('refuses an invalid commit sha', async () => {
    await expect(downloadTarball('main', routes({}))).rejects.toThrow('invalid commit sha');
  });

  it('surfaces HTTP errors', async () => {
    await expect(downloadTarball(COMMIT, routes({}))).rejects.toThrow('HTTP 404');
  });
});
