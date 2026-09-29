/**
 * Structured local logging to **stderr only**. stdout is reserved for the MCP protocol (stdio
 * transport), so anything written there would corrupt the JSON-RPC stream.
 *
 * Containment invariant (RN-07): the diagram source must never appear in a log. This module has no
 * transport other than stderr — there is no external log sink — and callers pass only codes,
 * formats, and durations, never the source text.
 */
export interface LogFields {
    readonly [key: string]: string | number | boolean | undefined;
}
export declare const logger: {
    info(event: string, fields?: LogFields): void;
    warn(event: string, fields?: LogFields): void;
    error(event: string, fields?: LogFields): void;
};
