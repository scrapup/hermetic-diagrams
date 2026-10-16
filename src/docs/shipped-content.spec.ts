import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanVendoredContent, type FileViolation } from '../aws/vendored-scan.js';
import { manifestSha256, type IconLock } from '../aws/icon-lock.js';
import { scanSecurity } from '../pep/security-scanner.js';

/**
 * TF-105-03 (`plan.md` §5.2 "The System is a safe source", §5.5): everything the System ships and
 * injects into a render is re-checked here, in CI, with the same strict rules as the update script —
 * so a manual edit of `assets/` cannot slip in. The lock and the files must also agree exactly.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCK_PATH = path.join(ROOT, 'aws-icons.lock.json');
const ICONS_DIR = path.join(ROOT, 'assets', 'aws-icons');
const LICENSES = new Set(['LICENSE', 'LICENSE-CODE']);

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as IconLock;
const setDir = path.join(ROOT, ...lock.root.split('/'));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const toRel = (full: string): string => path.relative(setDir, full).split(path.sep).join('/');
const shippedFiles = walk(setDir).map(toRel);

describe('shipped AWS icon set', () => {
  it('ships exactly one tag directory, the one pinned by the lock', () => {
    expect(readdirSync(ICONS_DIR)).toEqual([lock.tag]);
    expect(lock.root).toBe(`assets/aws-icons/${lock.tag}`);
  });

  it('ships the upstream licenses', () => {
    for (const license of LICENSES) expect(existsSync(path.join(setDir, license))).toBe(true);
  });

  it('lists every shipped file in the lock and nothing else', () => {
    const listed = lock.files.map((f) => f.path).sort();
    const shipped = shippedFiles.filter((f) => !LICENSES.has(f)).sort();
    expect(shipped).toEqual(listed);
  });

  it('matches every file to its locked sha256 and size', () => {
    const mismatches = lock.files.flatMap((f) => {
      const bytes = readFileSync(path.join(setDir, ...f.path.split('/')));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      return sha256 === f.sha256 && bytes.byteLength === f.bytes ? [] : [f.path];
    });
    expect(mismatches).toEqual([]);
  });

  it('covers the files with manifestSha256', () => {
    expect(manifestSha256(lock.files)).toBe(lock.manifestSha256);
  });

  it('contains no construct that reads outside the source (strict scan + scanSecurity)', () => {
    const violations: FileViolation[] = shippedFiles
      .filter((f) => f.endsWith('.puml'))
      .flatMap((f) =>
        scanVendoredContent(f, readFileSync(path.join(setDir, ...f.split('/')), 'utf8'), (source) =>
          scanSecurity('plantuml', source, Number.MAX_SAFE_INTEGER),
        ),
      );
    expect(violations).toEqual([]);
  });
});
