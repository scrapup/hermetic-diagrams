import { execFile } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from './compose.js';

const execFileAsync = promisify(execFile);

export interface PackedArtifact {
  /** Temp dir holding the tarball and its extraction. */
  readonly workDir: string;
  /** Absolute path of the `.tgz`. */
  readonly tarball: string;
  /** Extracted package root (`<workDir>/package`), i.e. what npm installs. */
  readonly packageRoot: string;
}

/**
 * Pack the repo exactly as it would be published (`npm pack` honours `files`) and extract it, with
 * `package-lock.json` shipped as `npm-shrinkwrap.json` — what the release job does before
 * `npm publish` (TF-79-02). Requires `npm run build` first (the package ships `dist/`).
 */
export async function packArtifact(): Promise<PackedArtifact> {
  const workDir = mkdtempSync(path.join(tmpdir(), 'hd-pack-'));
  const shrinkwrap = path.join(REPO_ROOT, 'npm-shrinkwrap.json');
  copyFileSync(path.join(REPO_ROOT, 'package-lock.json'), shrinkwrap);
  try {
    const { stdout } = await execFileAsync('npm', ['pack', '--json', '--pack-destination', workDir], {
      cwd: REPO_ROOT,
      maxBuffer: 32 * 1024 * 1024,
    });
    const [info] = JSON.parse(stdout) as [{ filename: string }];
    const tarball = path.join(workDir, info.filename);
    await execFileAsync('tar', ['-xzf', tarball, '-C', workDir]);
    return { workDir, tarball, packageRoot: path.join(workDir, 'package') };
  } finally {
    rmSync(shrinkwrap, { force: true });
  }
}

export function removeArtifact(artifact: PackedArtifact | undefined): void {
  if (artifact !== undefined) rmSync(artifact.workDir, { recursive: true, force: true });
}
