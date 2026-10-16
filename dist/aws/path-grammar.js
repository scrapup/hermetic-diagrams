/**
 * The single grammar for AWS icon-set paths (`plan.md` §4.5), shared by the maintainer update script,
 * the boot-time Icon Set Store and the AWS Include Resolver. A path is at most one directory level
 * deep, alphanumeric segments only — no `..`, no `%`, no leading `/`, no backslash. Anything that
 * fails it is never looked up, read or written.
 *
 * Kept dependency-free so the update script can import it under Node's native type stripping.
 */
export const ICON_PATH_GRAMMAR = /^(?:[A-Za-z0-9]+\/)?[A-Za-z0-9_]+\.puml$/;
/** Upstream release tag grammar (`v23.1`, `v18.0`, …). */
export const ICON_TAG_GRAMMAR = /^v\d+(?:\.\d+)*$/;
/** Reserved name of the synthesized per-category aggregate (never shipped as a file). */
export const CATEGORY_AGGREGATE = 'all.puml';
/** Category directory that holds the group macros (`AWSCloudGroup`, `VPCGroup`, …). */
export const GROUPS_CATEGORY = 'Groups';
export function isIconPath(value) {
    return ICON_PATH_GRAMMAR.test(value);
}
export function isIconTag(value) {
    return ICON_TAG_GRAMMAR.test(value);
}
/** Splits a grammar-valid path into kind/category/name. Callers must validate the grammar first. */
export function iconPathParts(path) {
    const slash = path.indexOf('/');
    const file = slash === -1 ? path : path.slice(slash + 1);
    const name = file.slice(0, -'.puml'.length);
    if (slash === -1)
        return { kind: 'base', category: null, name };
    const category = path.slice(0, slash);
    return { kind: category === GROUPS_CATEGORY ? 'group' : 'icon', category, name };
}
