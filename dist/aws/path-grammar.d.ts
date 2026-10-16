/**
 * The single grammar for AWS icon-set paths (`plan.md` §4.5), shared by the maintainer update script,
 * the boot-time Icon Set Store and the AWS Include Resolver. A path is at most one directory level
 * deep, alphanumeric segments only — no `..`, no `%`, no leading `/`, no backslash. Anything that
 * fails it is never looked up, read or written.
 *
 * Kept dependency-free so the update script can import it under Node's native type stripping.
 */
export declare const ICON_PATH_GRAMMAR: RegExp;
/** Upstream release tag grammar (`v23.1`, `v18.0`, …). */
export declare const ICON_TAG_GRAMMAR: RegExp;
/** Reserved name of the synthesized per-category aggregate (never shipped as a file). */
export declare const CATEGORY_AGGREGATE = "all.puml";
/** Category directory that holds the group macros (`AWSCloudGroup`, `VPCGroup`, …). */
export declare const GROUPS_CATEGORY = "Groups";
export declare function isIconPath(value: string): boolean;
export declare function isIconTag(value: string): boolean;
export type IconKind = 'base' | 'group' | 'icon';
export interface IconPathParts {
    readonly kind: IconKind;
    /** `null` for root (base) files. */
    readonly category: string | null;
    readonly name: string;
}
/** Splits a grammar-valid path into kind/category/name. Callers must validate the grammar first. */
export declare function iconPathParts(path: string): IconPathParts;
