import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/aws/icon-lock.ts';
import type { TarRunner } from './extract.ts';
import { buildLock, serializeLock } from './lock.ts';
import type { UpstreamFetch } from './fetch.ts';
import { formatViolations, inspectIconFiles, publishToGithub, readPreviousLock, runUpdate, type UpdateDeps } from './update.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/aws-icons/', import.meta.url));
const COMMIT = 'b788ba79e8cd028be274761f0fadd8bf3b711acd';
const ROOT = `aws-icons-for-plantuml-${COMMIT}`;
const API = 'https://api.github.com/repos/awslabs/aws-icons-for-plantuml';
const TARBALL = new TextEncoder().encode('fake-tarball');

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const sprite = (name: string): string => `sprite $${name} [1x1/16z] {\nx\n}\n!define ${name}(a) X(a)\n`;

/** Archive content keyed by member name (relative to the archive). */
type Archive = Map<string, Uint8Array>;

async function cleanArchive(): Promise<Archive> {
  const lambda = await readFile(join(FIXTURES, 'clean-icon.puml'));
  return new Map<string, Uint8Array>([
    [`${ROOT}/LICENSE`, enc('CC-BY-ND-2.0 text')],
    [`${ROOT}/LICENSE-CODE`, enc('MIT text')],
    [`${ROOT}/README.md`, enc('readme')],
    [`${ROOT}/dist/AWSCommon.puml`, enc("' common\n!define AWSEntity(a) a\n")],
    [`${ROOT}/dist/Compute/Lambda.puml`, lambda],
    [`${ROOT}/dist/Compute/EC2.puml`, enc(sprite('EC2'))],
    [`${ROOT}/dist/Compute/all.puml`, enc(`${sprite('EC2')}${lambda.toString()}`)],
    [`${ROOT}/dist/Groups/VPC.puml`, enc("' group\n!define VPCGroup(a) G(a)\n")],
    [`${ROOT}/dist/Groups/all.puml`, enc("!define VPCGroup(a) G(a)\n")],
  ]);
}

/** Simulates `tar` over an in-memory archive: `-tzf` lists, `-xzf … -C dir -T list` writes members. */
function fakeTar(archive: Archive): TarRunner {
  return async (args) => {
    if (args[0] === '-tzf') return [...archive.keys()].join('\n');
    const dest = args[args.indexOf('-C') + 1] ?? '';
    const list = await readFile(args[args.indexOf('-T') + 1] ?? '', 'utf8');
    for (const name of list.split('\n').filter((n) => n.length > 0)) {
      const bytes = archive.get(name);
      if (bytes === undefined) continue;
      const target = join(dest, ...name.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    return '';
  };
}

const fakeFetch: UpstreamFetch = (url) => {
  if (url === `${API}/git/ref/tags/v23.1`) {
    return Promise.resolve(new Response(JSON.stringify({ object: { type: 'commit', sha: COMMIT, url: 'x' } })));
  }
  if (url.endsWith(`/tar.gz/${COMMIT}`)) return Promise.resolve(new Response(TARBALL));
  return Promise.resolve(new Response('nope', { status: 404 }));
};

describe('runUpdate', () => {
  let repo: string;
  let deps: (archive: Archive, overrides?: Partial<UpdateDeps>) => UpdateDeps;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'hd-update-'));
    deps = (archive, overrides = {}) => ({
      repoRoot: repo,
      fetchImpl: fakeFetch,
      runTar: fakeTar(archive),
      scanner: () => undefined,
      today: '2026-10-14',
      tmpRoot: repo,
      ...overrides,
    });
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('vendors the clean set without all.puml, with licenses and a lock', async () => {
    const outcome = await runUpdate('v23.1', deps(await cleanArchive()));
    expect(outcome.ok).toBe(true);
    const dir = join(repo, 'assets/aws-icons/v23.1');
    expect((await readdir(dir)).sort()).toEqual(['AWSCommon.puml', 'Compute', 'Groups', 'LICENSE', 'LICENSE-CODE']);
    expect((await readdir(join(dir, 'Compute'))).sort()).toEqual(['EC2.puml', 'Lambda.puml']);
    const lock = JSON.parse(await readFile(join(repo, 'aws-icons.lock.json'), 'utf8')) as Record<string, unknown>;
    expect(lock).toMatchObject({ tag: 'v23.1', commit: COMMIT, tarballSha256: sha256Hex(TARBALL) });
    expect((lock.files as { path: string }[]).map((f) => f.path)).toEqual([
      'AWSCommon.puml',
      'Compute/EC2.puml',
      'Compute/Lambda.puml',
      'Groups/VPC.puml',
    ]);
  });

  it('copies upstream bytes unmodified', async () => {
    const archive = await cleanArchive();
    await runUpdate('v23.1', deps(archive));
    const shipped = await readFile(join(repo, 'assets/aws-icons/v23.1/Compute/Lambda.puml'));
    expect(sha256Hex(shipped)).toBe(sha256Hex(archive.get(`${ROOT}/dist/Compute/Lambda.puml`) ?? new Uint8Array()));
  });

  it('is reproducible: a re-run for the same tag changes nothing', async () => {
    await runUpdate('v23.1', deps(await cleanArchive()));
    const first = await readFile(join(repo, 'aws-icons.lock.json'), 'utf8');
    await runUpdate('v23.1', deps(await cleanArchive(), { today: '2026-12-31' }));
    expect(await readFile(join(repo, 'aws-icons.lock.json'), 'utf8')).toBe(first);
    expect((await readdir(join(repo, 'assets/aws-icons'))).sort()).toEqual(['v23.1']);
  });

  it.each([
    'include',
    'import',
    'theme',
    'getenv',
    'load_json',
    'get_all_stdlib',
    'dtd',
    'img_scheme',
    'url_scheme',
  ])('refuses a file with the %s construct and writes nothing', async (rule) => {
    const archive = await cleanArchive();
    const bad = await readFile(join(FIXTURES, 'refused', `${rule}.puml`));
    archive.set(`${ROOT}/dist/Compute/Bad.puml`, bad);
    const allPuml = new TextDecoder().decode(archive.get(`${ROOT}/dist/Compute/all.puml`));
    archive.set(`${ROOT}/dist/Compute/all.puml`, enc(`${allPuml}\n${new TextDecoder().decode(bad)}`));

    const outcome = await runUpdate('v23.1', deps(archive));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.violations).toContainEqual(expect.objectContaining({ file: 'Compute/Bad.puml', rule }));
    await expect(readdir(join(repo, 'assets'))).rejects.toThrow();
    await expect(readFile(join(repo, 'aws-icons.lock.json'))).rejects.toThrow();
  });

  it('refuses when the shipped scanner refuses a file', async () => {
    const scanner = (source: string): void => {
      if (source.includes('sprite $EC2')) throw new Error('nope');
    };
    const outcome = await runUpdate('v23.1', deps(await cleanArchive(), { scanner }));
    expect(outcome).toEqual({ ok: false, violations: [{ file: 'Compute/EC2.puml', rule: 'scanSecurity: nope', line: 0 }] });
  });

  it('refuses a broken all.puml equivalence', async () => {
    const archive = await cleanArchive();
    archive.set(`${ROOT}/dist/Compute/all.puml`, enc(sprite('EC2')));
    const outcome = await runUpdate('v23.1', deps(archive));
    expect(outcome).toEqual({
      ok: false,
      violations: [{ file: 'Compute/all.puml', rule: 'equivalence: sprites missing from all.puml: Lambda', line: 0 }],
    });
  });

  it('refuses an archive with an escaping member name before extracting', async () => {
    const archive = await cleanArchive();
    archive.set(`${ROOT}/dist/../../evil.puml`, enc('x'));
    const outcome = await runUpdate('v23.1', deps(archive));
    expect(outcome).toEqual({
      ok: false,
      violations: [{ file: `${ROOT}/dist/../../evil.puml`, rule: 'parent_segment', line: 0 }],
    });
  });

  it('refuses when extraction yields something other than the expected regular files', async () => {
    const archive = await cleanArchive();
    const tar = fakeTar(archive);
    const runTarWithExtra: TarRunner = async (args) => {
      const out = await tar(args);
      if (args[0] === '-xzf') await writeFile(join(args[args.indexOf('-C') + 1] ?? '', 'smuggled'), 'x');
      return out;
    };
    const outcome = await runUpdate('v23.1', deps(archive, { runTar: runTarWithExtra }));
    expect(outcome).toEqual({ ok: false, violations: [{ file: 'smuggled', rule: 'unexpected_entry', line: 0 }] });
  });

  it('replaces a previous vendoring of the same tag atomically', async () => {
    await mkdir(join(repo, 'assets/aws-icons/v23.1'), { recursive: true });
    await writeFile(join(repo, 'assets/aws-icons/v23.1/Stale.puml'), 'stale');
    await runUpdate('v23.1', deps(await cleanArchive()));
    const entries = await readdir(join(repo, 'assets/aws-icons/v23.1'));
    expect(entries).not.toContain('Stale.puml');
    expect(await readdir(join(repo, 'assets/aws-icons'))).toEqual(['v23.1']);
  });

  it('removes the superseded tag directory and reports the catalog difference', async () => {
    // A valid v23.0 lock that also listed an icon the new release no longer ships.
    const previousFiles = new Map([
      ['AWSCommon.puml', enc('old common')],
      ['Compute/Retired.puml', enc('retired')],
    ]);
    const previous = buildLock({ tag: 'v23.0', commit: 'a'.repeat(40), tarballSha256: 'b'.repeat(64), today: '2026-01-01', files: previousFiles });
    await writeFile(join(repo, 'aws-icons.lock.json'), serializeLock(previous));
    await mkdir(join(repo, 'assets/aws-icons/v23.0'), { recursive: true });

    const outcome = await runUpdate('v23.1', deps(await cleanArchive()));
    expect(await readdir(join(repo, 'assets/aws-icons'))).toEqual(['v23.1']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.diff).toMatchObject({ removed: ['Compute/Retired.puml'], breaking: true });
    expect(outcome.report).toContain('## AWS icons update: v23.0 → v23.1');
    expect(outcome.report).toContain(`| Tarball sha256 | \`${sha256Hex(TARBALL)}\` |`);
  });

  it('treats an invalid previous lock as absent and never uses its tag in a path', async () => {
    await runUpdate('v23.1', deps(await cleanArchive()));
    const lockPath = join(repo, 'aws-icons.lock.json');
    const old = JSON.parse(await readFile(lockPath, 'utf8')) as Record<string, unknown>;
    old.tag = '..';
    await writeFile(lockPath, JSON.stringify(old));
    await mkdir(join(repo, 'keep'), { recursive: true });
    const outcome = await runUpdate('v23.1', deps(await cleanArchive()));
    expect(outcome.ok && outcome.previous).toBe(null);
    expect(await readdir(repo)).toContain('keep');
    expect(await readdir(join(repo, 'assets'))).toEqual(['aws-icons']);
  });

  it('restores the previous vendoring when the promotion fails midway', async () => {
    await runUpdate('v23.1', deps(await cleanArchive()));
    const lockBefore = await readFile(join(repo, 'aws-icons.lock.json'), 'utf8');
    const commonBefore = await readFile(join(repo, 'assets/aws-icons/v23.1/AWSCommon.puml'));
    let calls = 0;
    // 1st rename: current dir -> backup (ok); 2nd: staging -> target (fails).
    const failing = async (from: string, to: string): Promise<void> => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      await rename(from, to);
    };
    await expect(runUpdate('v23.1', deps(await cleanArchive(), { rename: failing }))).rejects.toThrow('disk full');
    expect(await readdir(join(repo, 'assets/aws-icons'))).toEqual(['v23.1']);
    expect(await readFile(join(repo, 'assets/aws-icons/v23.1/AWSCommon.puml'))).toEqual(commonBefore);
    expect(await readFile(join(repo, 'aws-icons.lock.json'), 'utf8')).toBe(lockBefore);
    expect(await readdir(repo)).not.toContain(expect.stringMatching(/^\.aws-icons\.lock\.json\./));
  });

  it('cleans its temporary work directory', async () => {
    const tmpRoot = await mkdtemp(join(repo, 'tmp-'));
    await runUpdate('v23.1', deps(await cleanArchive(), { tmpRoot }));
    expect(await readdir(tmpRoot)).toEqual([]);
  });
});

describe('inspectIconFiles', () => {
  it('flags invalid UTF-8', () => {
    const result = inspectIconFiles(new Map([['A.puml', new Uint8Array([0xff, 0xfe])]]), () => undefined);
    expect(result.violations).toEqual([{ file: 'A.puml', rule: 'encoding: not valid UTF-8', line: 0 }]);
  });

  it('flags a root-level all.puml', () => {
    const result = inspectIconFiles(new Map([['all.puml', enc('x')]]), () => undefined);
    expect(result.violations).toEqual([{ file: 'all.puml', rule: 'unexpected_root_aggregate', line: 0 }]);
  });
});

describe('readPreviousLock', () => {
  it('returns null for missing, malformed or contract-invalid locks', () => {
    expect(readPreviousLock(null)).toBeNull();
    expect(readPreviousLock('{')).toBeNull();
    expect(readPreviousLock('null')).toBeNull();
    expect(readPreviousLock(JSON.stringify({ tag: 'v1', commit: 'c', tarballSha256: 't', vendoredOn: 'd', files: [] }))).toBeNull();
  });

  it('returns a lock that satisfies the shared contract', () => {
    const lock = buildLock({ tag: 'v1', commit: 'a'.repeat(40), tarballSha256: 'b'.repeat(64), today: '2026-01-01', files: new Map([['AWSCommon.puml', enc('x')]]) });
    expect(readPreviousLock(serializeLock(lock))).toEqual(lock);
  });
});

describe('formatViolations', () => {
  it('prints file[:line] and rule, one per line', () => {
    expect(
      formatViolations([
        { file: 'A.puml', rule: 'import', line: 3 },
        { file: 'B.puml', rule: 'symlink', line: 0 },
      ]),
    ).toBe('A.puml:3  import\nB.puml  symlink');
  });
});

describe('publishToGithub', () => {
  const diff = { added: [], removed: ['A.puml'], renamedCandidates: [], breaking: true };

  it('appends the report to the job summary and breaking/tag to the step outputs', async () => {
    const writes: Array<[string, string]> = [];
    await publishToGithub({ GITHUB_STEP_SUMMARY: '/s', GITHUB_OUTPUT: '/o' }, 'REPORT', diff, 'v23.2', (p, d) => {
      writes.push([p, d]);
      return Promise.resolve();
    });
    expect(writes).toEqual([
      ['/s', 'REPORT'],
      ['/o', 'breaking=true\ntag=v23.2\n'],
    ]);
  });

  it('does nothing outside GitHub Actions', async () => {
    const writes: string[] = [];
    await publishToGithub({}, 'REPORT', diff, 'v23.2', (p) => {
      writes.push(p);
      return Promise.resolve();
    });
    expect(writes).toEqual([]);
  });
});
