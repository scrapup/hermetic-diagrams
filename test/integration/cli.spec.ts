import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tearDownStack } from '../helpers/compose.js';
import { packArtifact, removeArtifact, type PackedArtifact } from '../helpers/package.js';

const execFileAsync = promisify(execFile);

/**
 * TF-79-06 (T-05, T-30, T-31): the published shape, run from a clean location, behaves as the
 * spec says — `serve` before `up` fails fast with the exact command, `up` prepares the version,
 * then `serve` attaches and the containment proof holds. The CLI imports only Node built-ins, so
 * it runs straight from the extracted tarball (no dependency install, no network).
 */

let artifact: PackedArtifact;
let version = '';
let bin = '';
let client: Client | undefined;

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly ms: number;
}

function runBin(args: readonly string[], timeoutMs: number): Promise<Run> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: artifact.workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`bin ${args.join(' ')} exceeded ${timeoutMs} ms\n${stderr}`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, ms: Date.now() - started });
    });
  });
}

beforeAll(async () => {
  artifact = await packArtifact();
  bin = path.join(artifact.packageRoot, 'dist', 'cli', 'bin.js');
  version = (
    (await import(path.join(artifact.packageRoot, 'package.json'), { with: { type: 'json' } })) as {
      default: { version: string };
    }
  ).default.version;
  // Clean state: no stack, no MCP image for this version.
  await tearDownStack();
  await execFileAsync('docker', ['image', 'rm', '-f', `hermetic-diagrams-mcp:${version}`]);
}, 300_000);

afterAll(async () => {
  await client?.close().catch(() => undefined);
  await tearDownStack();
  removeArtifact(artifact);
});

describe('compose version binding (T-05)', () => {
  const composeFile = (): string => path.join(artifact.packageRoot, 'compose.yaml');

  it('refuses to resolve the stack without HD_VERSION', async () => {
    const env = { ...process.env };
    delete env.HD_VERSION;

    await expect(
      execFileAsync('docker', ['compose', '-f', composeFile(), 'config', '--images'], { env }),
    ).rejects.toThrow(/HD_VERSION is required/);
  });

  it('tags the MCP image with HD_VERSION', async () => {
    // The gateway sits behind the `gateway` profile; enable it so compose lists its image.
    const { stdout } = await execFileAsync(
      'docker',
      ['compose', '-f', composeFile(), '--profile', 'gateway', 'config', '--images'],
      { env: { ...process.env, HD_VERSION: version } },
    );

    expect(stdout).toContain(`hermetic-diagrams-mcp:${version}`);
  });
});

describe('packed CLI: serve → up → serve (T-30, T-31)', () => {
  it('serve before up fails fast with the exact up command, and prints nothing on stdout', async () => {
    const run = await runBin([], 60_000);

    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain(`run: npx @scrapup/hermetic-diagrams@${version} up`);
    expect(run.stdout).toBe('');
    expect(run.ms).toBeLessThan(60_000);
  }, 90_000);

  it('up prepares the version: exit 0, MCP image present, Kroki healthy', async () => {
    const run = await runBin(['up'], 600_000);
    console.info(`[TF-79-06] cold up took ${run.ms} ms`);

    expect(run.code).toBe(0);
    expect(run.stderr).toContain(`version ${version} is ready.`);
    expect(run.stdout).toBe('');
    const { stdout } = await execFileAsync('docker', [
      'image', 'inspect', '--format', '{{.Id}}', `hermetic-diagrams-mcp:${version}`,
    ]);
    expect(stdout.trim()).not.toBe('');
  }, 660_000);

  it('serve attaches over stdio and reports containment', async () => {
    client = new Client({ name: 'hermetic-diagrams-cli-it', version: '0.0.0' });
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [bin], cwd: artifact.workDir }),
    );

    const tools = await client.listTools();
    const status = (await client.callTool({ name: 'containment_status', arguments: {} })) as {
      content: { type: string; text?: string }[];
    };

    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['render_diagram', 'list_formats', 'containment_status']),
    );
    expect(JSON.parse(status.content[0]!.text!)).toMatchObject({ contained: true });
    await client.close();
    client = undefined;
  }, 300_000);

  it('a second up on a prepared version succeeds', async () => {
    const run = await runBin(['up'], 600_000);

    expect(run.code).toBe(0);
  }, 660_000);
});
