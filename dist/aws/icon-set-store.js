import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../logger.js';
import { parseLock, sha256Hex } from './icon-lock.js';
function unverified(reason, version, failedFiles) {
    return { state: 'UNVERIFIED', reason, version, files: new Map(), categories: new Map(), failedFiles };
}
async function readLock(lockPath) {
    try {
        return parseLock(JSON.parse(await readFile(lockPath, 'utf8')));
    }
    catch {
        return null;
    }
}
/**
 * @param iconsRoot directory holding `<tag>/` (in the image: `/app/assets/aws-icons`)
 * @param lockPath  path of `aws-icons.lock.json`
 */
export async function loadIconSet(iconsRoot, lockPath) {
    const lock = await readLock(lockPath);
    if (lock === null)
        return unverified('lock_invalid', null, 1);
    const setDir = path.join(iconsRoot, lock.tag);
    const files = new Map();
    let missing = 0;
    let mismatched = 0;
    for (const file of lock.files) {
        // Paths were re-validated against the grammar by parseLock before reaching this fs call.
        let bytes;
        try {
            bytes = await readFile(path.join(setDir, ...file.path.split('/')));
        }
        catch {
            missing += 1;
            continue;
        }
        if (bytes.byteLength !== file.bytes || sha256Hex(bytes) !== file.sha256) {
            mismatched += 1;
            continue;
        }
        files.set(file.path, bytes.toString('utf8'));
    }
    if (missing > 0)
        return unverified('file_missing', lock.tag, missing + mismatched);
    if (mismatched > 0)
        return unverified('hash_mismatch', lock.tag, mismatched);
    const categories = new Map();
    for (const [category, names] of Object.entries(lock.categories)) {
        categories.set(category, names.map((name) => `${category}/${name}.puml`));
    }
    return { state: 'VERIFIED', version: lock.tag, files, categories, failedFiles: 0 };
}
export function awsIconsStatus(iconSet) {
    return {
        state: iconSet.state === 'VERIFIED' ? 'verified' : 'unverified',
        version: iconSet.version,
        ...(iconSet.reason !== undefined ? { reason: iconSet.reason } : {}),
    };
}
/** Boot-time load with the `boot.aws_icons` event (`plan.md` §5.3): counts only, never names. */
export async function bootIconSet(iconsRoot, lockPath, log = logger) {
    const started = performance.now();
    const set = await loadIconSet(iconsRoot, lockPath);
    const durationMs = Math.round(performance.now() - started);
    if (set.state === 'VERIFIED') {
        const fields = { state: 'verified', version: set.version ?? undefined, files: set.files.size, durationMs };
        log.info('boot.aws_icons', fields);
    }
    else {
        log.warn('boot.aws_icons', { state: 'unverified', reason: set.reason, count: set.failedFiles, durationMs });
    }
    return set;
}
