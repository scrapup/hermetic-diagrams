import { type IconKind } from './path-grammar.ts';
export declare const ICON_LOCK_SCHEMA_VERSION = 1;
export declare const ICON_UPSTREAM = "awslabs/aws-icons-for-plantuml";
export interface IconLockFile {
    readonly path: string;
    readonly kind: IconKind;
    /** `null` for base (root) files. */
    readonly category: string | null;
    readonly name: string;
    readonly sha256: string;
    readonly bytes: number;
}
export interface IconLock {
    readonly $schemaVersion: typeof ICON_LOCK_SCHEMA_VERSION;
    readonly upstream: typeof ICON_UPSTREAM;
    readonly tag: string;
    readonly commit: string;
    readonly tarballSha256: string;
    readonly vendoredOn: string;
    readonly root: string;
    readonly files: readonly IconLockFile[];
    /** category → icon names in manifest order (drives the synthetic `<Category>/all.puml`). */
    readonly categories: Readonly<Record<string, readonly string[]>>;
    readonly manifestSha256: string;
}
export declare function sha256Hex(data: string | Uint8Array): string;
/** Code-point ordering: locale-independent, so every machine produces the same lock. */
export declare function compareCodePoints(a: string, b: string): number;
/** Canonical JSON of `files`: sorted by path, keys in a fixed order. */
export declare function canonicalFilesJson(files: readonly IconLockFile[]): string;
export declare function manifestSha256(files: readonly IconLockFile[]): string;
export declare function iconSetRoot(tag: string): string;
/** category → icon names in manifest order; the writer and the verifier both derive it here. */
export declare function deriveCategories(files: readonly IconLockFile[]): Map<string, string[]>;
/** Validates the lock contract (`plan.md` §3.1). Any deviation → `null` (treated as `lock_invalid`). */
export declare function parseLock(value: unknown): IconLock | null;
