import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T-34 (TF-80-01, RN-12): the public README exists in English (source), Portuguese and Japanese
 * with the same structure and byte-identical code blocks; only prose is translated. The version
 * pinned in the install commands tracks package.json (release-please bumps it).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Normalize line endings: Windows checkouts (core.autocrlf) turn LF into CRLF.
const read = (file: string): string =>
  readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

const FILES = { en: 'README.md', pt: 'README.pt.md', ja: 'README.ja.md' } as const;
const NAV = {
  en: '🌐 **English** | [日本語](./README.ja.md) | [Português](./README.pt.md)',
  pt: '🌐 [English](./README.md) | [日本語](./README.ja.md) | **Português**',
  ja: '🌐 [English](./README.md) | **日本語** | [Português](./README.pt.md)',
} as const;

const docs = Object.fromEntries(
  Object.entries(FILES).map(([lang, file]) => [lang, read(file)]),
) as Record<keyof typeof FILES, string>;

const codeBlocks = (md: string): string[] => md.match(/^```[\s\S]*?^```$/gm) ?? [];
const headingLevels = (md: string): string[] =>
  md
    .replace(/^```[\s\S]*?^```$/gm, '')
    .split('\n')
    .filter((l) => /^#{1,6} /.test(l))
    .map((l) => l.split(' ')[0]!);
const version = (JSON.parse(read('package.json')) as { version: string }).version;

describe('trilingual README', () => {
  it.each(Object.keys(FILES) as (keyof typeof FILES)[])('%s starts with the language navigation line', (lang) => {
    expect(docs[lang].split('\n')[2]).toBe(NAV[lang]);
  });

  it.each(['pt', 'ja'] as const)('%s has the same code blocks as English', (lang) => {
    expect(codeBlocks(docs[lang])).toEqual(codeBlocks(docs.en));
  });

  it.each(['pt', 'ja'] as const)('%s has the same heading structure as English', (lang) => {
    expect(headingLevels(docs[lang])).toEqual(headingLevels(docs.en));
  });

  it('pins the current package version in the install commands', () => {
    expect(docs.en).toContain(`npx @scrapup/hermetic-diagrams@${version} up`);
    expect(docs.en).toContain(`"${version}"`);
  });

  it('keeps every pinned version inside release-please version markers', () => {
    for (const md of Object.values(docs)) {
      const outside = md.replace(/<!-- x-release-please-start-version -->[\s\S]*?<!-- x-release-please-end -->/g, '');
      expect(outside).not.toContain(`@${version}`);
      expect(outside).not.toContain(`"${version}"`);
    }
  });

  it('is bumped by release-please on every release', () => {
    const config = JSON.parse(read('release-please-config.json')) as {
      packages: Record<string, { 'extra-files': { type: string; path: string }[] }>;
    };

    for (const file of Object.values(FILES)) {
      expect(config.packages['.']!['extra-files']).toContainEqual({ type: 'generic', path: file });
    }
  });
});
