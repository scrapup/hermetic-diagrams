/**
 * Strict vendored-content scan (aws-icons `plan.md` §5.5 step 4). The System is a safe source: nothing it ships
 * and injects into a render may read outside the source. These rules are **stricter** than the
 * Requester-facing Security Scanner — any `!include*` (nesting is refused by design, D-05), any
 * environment/JSON/stdlib read, any DTD, and any URL scheme except the exact SVG namespace literal.
 *
 * Used by the update script (blocks an update) and by the shipped-content unit test (catches manual
 * edits). Dependency-free so it runs under Node's native type stripping.
 */
export interface StrictViolation {
    readonly rule: string;
    /** 1-based line number. */
    readonly line: number;
}
export interface FileViolation {
    readonly file: string;
    readonly rule: string;
    /** 1-based line number; `0` when the violation concerns the whole file. */
    readonly line: number;
}
/** Validates a whole source and throws on refusal (the shipped `scanSecurity`, bound to a notation). */
export type SourceScanner = (source: string) => void;
export declare function isGuideInclude(line: string): boolean;
export interface StrictScanOptions {
    /** Exempts a line from the `include` rule (guides only). */
    readonly allowInclude?: (line: string) => boolean;
}
/** Applies the strict rules to every non-comment line. */
export declare function strictScan(content: string, options?: StrictScanOptions): StrictViolation[];
/** Strict rules plus the shipped scanner, reported per file. */
export declare function scanVendoredContent(file: string, content: string, scanner: SourceScanner): FileViolation[];
