import { readFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Version binding (TF-79-01, RN-06). The MCP image is tagged with the package version, so a version
 * never runs on top of what another version prepared. The version is read only from the shipped
 * `package.json` — never from git or the environment.
 */
export const PACKAGE_NAME = '@scrapup/hermetic-diagrams';
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Extract and validate the `version` field of a `package.json` document. */
export function parseVersion(packageJson) {
    let parsed;
    try {
        parsed = JSON.parse(packageJson);
    }
    catch {
        throw new Error('package.json is not valid JSON');
    }
    const version = typeof parsed === 'object' && parsed !== null && 'version' in parsed ? parsed.version : undefined;
    if (typeof version !== 'string' || !SEMVER.test(version)) {
        throw new Error('package.json has no valid semver "version"');
    }
    return version;
}
/** Read the version of the package installed at `packageRoot`. */
export function readPackageVersion(packageRoot) {
    return parseVersion(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}
/** Local tag of the MCP gateway image for `version`. */
export function imageRef(version) {
    return `hermetic-diagrams-mcp:${version}`;
}
/** The exact one-time preparation command for `version`. */
export function upCommand(version) {
    return `npx ${PACKAGE_NAME}@${version} up`;
}
