import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { imageRef, parseVersion, readPackageVersion, upCommand } from './version.js';

describe('parseVersion', () => {
  it('returns the semver version', () => {
    expect(parseVersion('{"version":"0.3.1"}')).toBe('0.3.1');
  });

  it('accepts a pre-release version', () => {
    expect(parseVersion('{"version":"1.0.0-rc.1"}')).toBe('1.0.0-rc.1');
  });

  it('rejects a missing version', () => {
    expect(() => parseVersion('{"name":"x"}')).toThrow('no valid semver');
  });

  it('rejects a non-semver version', () => {
    expect(() => parseVersion('{"version":"latest"}')).toThrow('no valid semver');
  });

  it('rejects a non-string version', () => {
    expect(() => parseVersion('{"version":1}')).toThrow('no valid semver');
  });

  it('rejects a document that is not an object', () => {
    expect(() => parseVersion('null')).toThrow('no valid semver');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseVersion('{')).toThrow('not valid JSON');
  });
});

describe('readPackageVersion', () => {
  let dir = '';

  afterEach(() => {
    if (dir !== '') rmSync(dir, { recursive: true, force: true });
  });

  it('reads the version from <root>/package.json', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'hd-version-'));
    writeFileSync(path.join(dir, 'package.json'), '{"version":"2.4.6"}');

    expect(readPackageVersion(dir)).toBe('2.4.6');
  });

  it('throws when package.json is absent', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'hd-version-'));

    expect(() => readPackageVersion(dir)).toThrow();
  });
});

describe('imageRef / upCommand', () => {
  it('tags the MCP image with the version', () => {
    expect(imageRef('0.3.1')).toBe('hermetic-diagrams-mcp:0.3.1');
  });

  it('builds the exact pinned up command', () => {
    expect(upCommand('0.3.1')).toBe('npx @scrapup/hermetic-diagrams@0.3.1 up');
  });
});
