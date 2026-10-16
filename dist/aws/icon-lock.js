/**
 * `aws-icons.lock.json` contract (`plan.md` §3.1): the pinned upstream release plus a per-file
 * integrity manifest. Written by the maintainer update script, verified by the Icon Set Store at
 * every boot. The canonical form of `files` (sorted by path, fixed key order) is what
 * `manifestSha256` covers, so the writer and the verifier must share this module.
 *
 * Dependency-free apart from `node:crypto`, so the update script can import it under Node's native
 * type stripping.
 */
import { createHash } from 'node:crypto';
// `.ts` suffix (rewritten to `.js` on build): the maintainer script imports this module under Node's
// native type stripping, where only real file names resolve.
import { CATEGORY_AGGREGATE, iconPathParts, isIconPath, isIconTag } from "./path-grammar.js";
export const ICON_LOCK_SCHEMA_VERSION = 1;
export const ICON_UPSTREAM = 'awslabs/aws-icons-for-plantuml';
export function sha256Hex(data) {
    return createHash('sha256').update(data).digest('hex');
}
/** Code-point ordering: locale-independent, so every machine produces the same lock. */
export function compareCodePoints(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
/** Canonical JSON of `files`: sorted by path, keys in a fixed order. */
export function canonicalFilesJson(files) {
    const ordered = [...files]
        .sort((a, b) => compareCodePoints(a.path, b.path))
        .map((f) => ({
        path: f.path,
        kind: f.kind,
        category: f.category,
        name: f.name,
        sha256: f.sha256,
        bytes: f.bytes,
    }));
    return JSON.stringify(ordered);
}
export function manifestSha256(files) {
    return sha256Hex(canonicalFilesJson(files));
}
export function iconSetRoot(tag) {
    return `assets/aws-icons/${tag}`;
}
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseLockFile(value) {
    if (!isRecord(value))
        return null;
    const { path: filePath, kind, category, name, sha256, bytes } = value;
    if (typeof filePath !== 'string' || !isIconPath(filePath))
        return null;
    // The aggregate is synthesized, never shipped: a listed `all.puml` would shadow it.
    if (filePath === CATEGORY_AGGREGATE || filePath.endsWith(`/${CATEGORY_AGGREGATE}`))
        return null;
    const parts = iconPathParts(filePath);
    if (kind !== parts.kind || category !== parts.category || name !== parts.name)
        return null;
    if (typeof sha256 !== 'string' || !HEX64.test(sha256))
        return null;
    if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0)
        return null;
    return { path: filePath, kind: parts.kind, category: parts.category, name: parts.name, sha256, bytes };
}
/** category → icon names in manifest order; the writer and the verifier both derive it here. */
export function deriveCategories(files) {
    const categories = new Map();
    for (const file of files) {
        if (file.category === null)
            continue;
        const list = categories.get(file.category) ?? [];
        list.push(file.name);
        categories.set(file.category, list);
    }
    return categories;
}
function sameCategories(declared, derived) {
    if (!isRecord(declared))
        return false;
    const keys = Object.keys(declared);
    if (keys.length !== derived.size)
        return false;
    return keys.every((key) => {
        const names = declared[key];
        const expected = derived.get(key);
        return (Array.isArray(names) &&
            expected !== undefined &&
            names.length === expected.length &&
            names.every((n, i) => n === expected[i]));
    });
}
/** Validates the lock contract (`plan.md` §3.1). Any deviation → `null` (treated as `lock_invalid`). */
export function parseLock(value) {
    if (!isRecord(value))
        return null;
    const { $schemaVersion, upstream, tag, commit, tarballSha256, vendoredOn, root, files, categories } = value;
    if ($schemaVersion !== ICON_LOCK_SCHEMA_VERSION || upstream !== ICON_UPSTREAM)
        return null;
    if (typeof tag !== 'string' || !isIconTag(tag))
        return null;
    if (typeof commit !== 'string' || !HEX40.test(commit))
        return null;
    if (typeof tarballSha256 !== 'string' || !HEX64.test(tarballSha256))
        return null;
    if (typeof vendoredOn !== 'string' || !ISO_DATE.test(vendoredOn))
        return null;
    if (root !== iconSetRoot(tag))
        return null;
    if (!Array.isArray(files) || files.length === 0)
        return null;
    const parsed = [];
    const seen = new Set();
    for (const entry of files) {
        const file = parseLockFile(entry);
        if (file === null || seen.has(file.path))
            return null;
        seen.add(file.path);
        parsed.push(file);
    }
    const manifest = manifestSha256(parsed);
    if (value.manifestSha256 !== manifest)
        return null;
    const derived = deriveCategories(parsed);
    if (!sameCategories(categories, derived))
        return null;
    return {
        $schemaVersion: ICON_LOCK_SCHEMA_VERSION,
        upstream: ICON_UPSTREAM,
        tag,
        commit,
        tarballSha256,
        vendoredOn,
        root,
        files: parsed,
        categories: Object.fromEntries(derived),
        manifestSha256: manifest,
    };
}
