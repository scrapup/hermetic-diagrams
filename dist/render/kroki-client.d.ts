import type { OutputFormat } from '../domain.js';
/**
 * The only outbound HTTP the MCP ever makes — and only to the **internal** Kroki host over the
 * `internal: true` network (`plan.md` §4.4). Hard rules:
 *  - **Always POST with the source in the body** — never GET with the source in the URL (which would
 *    leak the source into logs/caches, RN-07).
 *  - Enforce a render timeout via `AbortController` that covers the **whole** render, including the
 *    response-body read (a slow/hung body must still time out).
 *  - Cap the response size while streaming, so a huge render is rejected before it is buffered.
 */
/** Minimal fetch surface, so tests can inject a mock without a live Kroki. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export interface KrokiRenderParams {
    readonly baseUrl: string;
    readonly diagramType: string;
    readonly output: OutputFormat;
    readonly source: string;
    readonly timeoutMs: number;
    readonly maxOutputBytes: number;
}
export interface KrokiRenderResult {
    readonly bytes: Uint8Array;
    readonly contentType: string;
}
/**
 * Render `source` via the internal Kroki, POSTing the body. Throws {@link HermeticError}:
 *  - `RENDER_TIMEOUT` if the whole request+read exceeds the timeout;
 *  - `INVALID_SYNTAX` on a Kroki 4xx (the engine rejected the source — a requester error, RN-09);
 *  - `RENDER_ERROR` on a 5xx or a transport failure.
 */
export declare function renderWithKroki(params: KrokiRenderParams, fetchImpl?: FetchLike): Promise<KrokiRenderResult>;
