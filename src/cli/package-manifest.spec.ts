import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T-09 (TF-79-02): the npm `files` allowlist ships everything `up` needs to build the MCP image
 * on the user's machine, and never the TypeScript sources. The real tarball is exercised by
 * test/integration/package.spec.ts.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  files: string[];
  bin: Record<string, string>;
};

describe('package.json files', () => {
  it.each(['dist', 'compose.yaml', 'Dockerfile', '.dockerignore', 'npm-shrinkwrap.json', 'images.lock'])(
    'ships %s',
    (entry) => {
      expect(pkg.files).toContain(entry);
    },
  );

  it.each(['src', 'test', 'tsconfig.json', 'tsconfig.build.json', 'package-lock.json'])(
    'does not ship %s',
    (entry) => {
      expect(pkg.files).not.toContain(entry);
    },
  );

  it('exposes the bin from the shipped dist', () => {
    expect(pkg.bin['hermetic-diagrams']).toBe('dist/cli/bin.js');
  });
});

describe('.dockerignore', () => {
  const entries = readFileSync(path.join(ROOT, '.dockerignore'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim());

  it('keeps dist in the build context (the image copies it)', () => {
    expect(entries).not.toContain('dist');
  });

  it('keeps sources and node_modules out of the build context', () => {
    expect(entries).toEqual(expect.arrayContaining(['src', 'node_modules']));
  });
});
