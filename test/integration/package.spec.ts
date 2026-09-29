import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { packArtifact, removeArtifact, type PackedArtifact } from '../helpers/package.js';

const execFileAsync = promisify(execFile);

/**
 * TF-79-02 (T-07, T-08): the published package alone is enough to build the MCP image — no source
 * checkout, no TypeScript compile — and the image keeps its hardening (non-root, no ports, no src).
 * Uses a throwaway version tag so it never touches the images other suites rely on.
 */

const TEST_VERSION = '0.0.0-packtest';
const IMAGE = `hermetic-diagrams-mcp:${TEST_VERSION}`;

let artifact: PackedArtifact | undefined;

beforeAll(async () => {
  artifact = await packArtifact();
  await execFileAsync(
    'docker',
    ['compose', '-f', path.join(artifact.packageRoot, 'compose.yaml'), 'build', 'mcp'],
    {
      cwd: artifact.packageRoot,
      env: { ...process.env, HD_VERSION: TEST_VERSION },
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
}, 660_000);

afterAll(async () => {
  await execFileAsync('docker', ['image', 'rm', '-f', IMAGE]).catch(() => undefined);
  removeArtifact(artifact);
});

async function inspect(format: string): Promise<string> {
  const { stdout } = await execFileAsync('docker', ['image', 'inspect', '--format', format, IMAGE]);
  return stdout.trim();
}

describe('published package → client-side MCP image (TF-79-02)', () => {
  it('ships what the build needs and nothing from the source tree', () => {
    const root = artifact!.packageRoot;

    expect(existsSync(path.join(root, 'Dockerfile'))).toBe(true);
    expect(existsSync(path.join(root, '.dockerignore'))).toBe(true);
    expect(existsSync(path.join(root, 'npm-shrinkwrap.json'))).toBe(true);
    expect(existsSync(path.join(root, 'dist', 'index.js'))).toBe(true);
    expect(existsSync(path.join(root, 'src'))).toBe(false);
  });

  it('builds the image tagged with the version from the extracted tarball alone', async () => {
    expect(await inspect('{{index .RepoTags 0}}')).toBe(IMAGE);
  });

  it('runs as the non-root node user', async () => {
    expect(await inspect('{{.Config.User}}')).toBe('node');
  });

  it('exposes no ports', async () => {
    expect(await inspect('{{json .Config.ExposedPorts}}')).toBe('null');
  });

  it('contains the prebuilt dist and production deps but no TypeScript sources', async () => {
    const { stdout } = await execFileAsync('docker', [
      'run', '--rm', '--network', 'none', '--entrypoint', 'sh', IMAGE, '-c',
      'ls /app; test -f /app/dist/index.js && echo has-dist; test -d /app/node_modules/@modelcontextprotocol && echo has-deps',
    ]);

    expect(stdout).toContain('has-dist');
    expect(stdout).toContain('has-deps');
    expect(stdout).not.toMatch(/^src$/m);
    expect(stdout).not.toMatch(/tsconfig/);
  });
});
