import { type DiagramFormat, type OutputFormat } from '../domain.js';
/**
 * Extracts the executable examples of a guide (aws-icons `plan.md` §3.3, D-08): fenced blocks whose
 * info string is exactly `hermetic-example format=<notation> output=<svg|png>`. The parser is strict
 * — an unknown, duplicated or missing attribute, or an unterminated block, is an error — so an
 * example can never silently drop out of the CI proof (RN-14).
 */
export interface GuideExample {
    readonly format: DiagramFormat;
    readonly output: OutputFormat;
    readonly source: string;
    /** 1-based line of the opening fence. */
    readonly line: number;
}
export declare function extractExamples(markdown: string): GuideExample[];
