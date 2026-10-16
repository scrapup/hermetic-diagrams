import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUIDE_IDS } from './guide-ids.js';
import { loadGuideCatalog, parseGuide } from './guide-catalog.js';

describe('parseGuide', () => {
  it('takes the first # line as title and the next paragraph as summary', () => {
    const guide = parseGuide('d2', '# D2 diagrams\n\nFirst line\nsecond line.\n\nMore.\n\n## When to use\n');
    expect(guide).toMatchObject({ id: 'd2', title: 'D2 diagrams', summary: 'First line second line.', notation: 'd2' });
  });

  it('falls back to the id when there is no title and stops the summary at a heading', () => {
    expect(parseGuide('erd', 'intro\n## Section')).toMatchObject({ title: 'erd', summary: 'intro' });
  });

  it.each([
    ['aws-architecture', 'plantuml'],
    ['aws-sequence', 'plantuml'],
    ['aws-simplified', 'plantuml'],
    ['aws-dark', 'plantuml'],
    ['aws-c4', 'c4'],
    ['vega-lite', 'vega-lite'],
  ] as const)('maps %s to the %s notation', (id, notation) => {
    expect(parseGuide(id, '# T').notation).toBe(notation);
  });
});

describe('loadGuideCatalog', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'hd-guides-'));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('loads the closed id set, resolving the icon-set version placeholder', async () => {
    await writeFile(path.join(dir, 'aws-dark.md'), '# Dark\n\nIcons {{AWS_ICONS_VERSION}}.\n');
    await writeFile(path.join(dir, 'unlisted.md'), '# Not a guide\n');
    const catalog = await loadGuideCatalog(dir, 'v23.1');
    expect([...catalog.guides.keys()]).toEqual(['aws-dark']);
    expect(catalog.guides.get('aws-dark')?.markdown).toBe('# Dark\n\nIcons v23.1.\n');
    expect(catalog.awsIconsVersion).toBe('v23.1');
  });

  it('marks the version unavailable when the icon set is not verified', async () => {
    await writeFile(path.join(dir, 'aws-dark.md'), '# Dark\n\n{{AWS_ICONS_VERSION}}\n');
    const catalog = await loadGuideCatalog(dir, null);
    expect(catalog.guides.get('aws-dark')?.summary).toBe('unavailable');
  });

  it('warns guides.ready with counts when guides are missing', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await loadGuideCatalog(dir, 'v23.1');
    const logged = write.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain(`"level":"warn","event":"guides.ready","count":0,"expected":${GUIDE_IDS.length},"missing":${GUIDE_IDS.length},"missingIds":"${GUIDE_IDS.join(',')}"`);
  });

  it('reports an unreadable guide by id and errno code, never by path', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await mkdir(path.join(dir, 'aws-dark.md'));
    await loadGuideCatalog(dir, 'v23.1');
    const logged = write.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain('"event":"guides.unreadable","id":"aws-dark","code":"EISDIR"');
    expect(logged).not.toContain(dir);
    expect(logged).toContain('"missingIds":"');
  });

  it('reports guides.ready at info level when every guide loads', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    await loadGuideCatalog(path.join(root, 'assets', 'guides'), 'v23.1');
    const logged = write.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain(`"level":"info","event":"guides.ready","count":${GUIDE_IDS.length},"expected":${GUIDE_IDS.length},"missing":0`);
  });

  it('loads all shipped guides', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const catalog = await loadGuideCatalog(path.join(root, 'assets', 'guides'), 'v23.1');
    expect([...catalog.guides.keys()]).toEqual([...GUIDE_IDS]);
    expect([...catalog.guides.values()].some((g) => g.markdown.includes('{{AWS_ICONS_VERSION}}'))).toBe(false);
  });
});
