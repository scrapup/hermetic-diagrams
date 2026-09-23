import type { HermeticConfig } from '../config.js';
import { type FetchLike } from './kroki-client.js';
import type { ConcurrencyGuard } from './concurrency.js';
/**
 * The end-to-end render path (`plan.md` §5.2 sequence): the three PEP barriers, then the
 * concurrency guard, the internal Kroki client, and finally SVG sanitization. Every failure is a
 * {@link HermeticError} with a stable code; the source is never logged (RN-07).
 */
export interface RenderRequest {
    readonly format: unknown;
    readonly source: unknown;
    readonly output?: unknown;
}
export interface RenderOutcome {
    readonly format: 'svg' | 'png';
    readonly mimeType: string;
    readonly encoding: 'utf8' | 'base64';
    readonly data: string;
}
export interface RenderPipelineDeps {
    readonly config: HermeticConfig;
    readonly guard: ConcurrencyGuard;
    readonly fetchImpl?: FetchLike;
}
export declare function renderDiagram(request: RenderRequest, deps: RenderPipelineDeps): Promise<RenderOutcome>;
