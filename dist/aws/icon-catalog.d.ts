import type { IconSet } from './icon-set-store.js';
/**
 * Icon Catalog (aws-icons `plan.md` §4.2): a read-only search over the verified, in-memory icon set
 * behind `list_aws_icons`. Macro names are derived from the file name following the upstream
 * convention (`<Name>`, `<Name>Participant`; groups `<Name>Group`) — never parsed from content.
 */
export declare const DEFAULT_ICON_LIMIT = 50;
export declare const MAX_ICON_LIMIT = 200;
export declare const MAX_QUERY_CHARS = 64;
export interface IconSearch {
    readonly category?: string | undefined;
    readonly query?: string | undefined;
    readonly limit: number;
}
export interface CatalogIcon {
    readonly category: string;
    readonly name: string;
    readonly include: string;
    readonly macros: readonly string[];
}
export interface IconSearchResult {
    readonly version: string | null;
    /** Icons and groups in the shipped set. */
    readonly total: number;
    /** Icons and groups matching the filters (before `limit`). */
    readonly matched: number;
    readonly returned: number;
    readonly categories: readonly string[];
    readonly icons: readonly CatalogIcon[];
    /** Include lines of the base files (`AWSCommon.puml` first). */
    readonly base: readonly string[];
}
export declare function includeLine(path: string): string;
export declare function macrosFor(category: string, name: string): string[];
export declare function searchIcons(iconSet: IconSet, search: IconSearch): IconSearchResult;
