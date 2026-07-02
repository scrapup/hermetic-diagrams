import { HermeticError } from '../errors.js';
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

/** Max chars of a Kroki error body echoed back as `detail` (never the source). */
const MAX_DETAIL_CHARS = 500;

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

function outputTooLarge(maxOutputBytes: number): HermeticError {
  return new HermeticError('RENDER_ERROR', `Rendered output exceeds ${maxOutputBytes} bytes.`);
}

async function readCapped(
  response: Response,
  maxOutputBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > maxOutputBytes) {
    throw outputTooLarge(maxOutputBytes);
  }

  const body = response.body;
  if (body === null) {
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > maxOutputBytes) throw outputTooLarge(maxOutputBytes);
    return buf;
  }

  // `Response.body` is typed as `ReadableStream<any>` in the DOM lib; narrow to bytes.
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      // The timeout aborts the controller; surface it as a timeout rather than hanging on read.
      if (signal.aborted) throw new HermeticError('RENDER_TIMEOUT', 'Render aborted while reading the response.');
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxOutputBytes) throw outputTooLarge(maxOutputBytes);
        chunks.push(value);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Render `source` via the internal Kroki, POSTing the body. Throws {@link HermeticError}:
 *  - `RENDER_TIMEOUT` if the whole request+read exceeds the timeout;
 *  - `INVALID_SYNTAX` on a Kroki 4xx (the engine rejected the source — a requester error, RN-09);
 *  - `RENDER_ERROR` on a 5xx or a transport failure.
 */
export async function renderWithKroki(
  params: KrokiRenderParams,
  fetchImpl: FetchLike = fetch,
): Promise<KrokiRenderResult> {
  const { baseUrl, diagramType, output, source, timeoutMs, maxOutputBytes } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/${diagramType}/${output}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Accept: output === 'svg' ? 'image/svg+xml' : 'image/png',
        },
        body: source,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new HermeticError('RENDER_TIMEOUT', `Render exceeded ${timeoutMs} ms and was aborted.`);
      }
      const reason = err instanceof Error ? err.message : 'unknown transport error';
      throw new HermeticError('RENDER_ERROR', 'Failed to reach the rendering engine.', reason);
    }

    if (!response.ok) {
      // Kroki returns a plaintext diagnostic. 4xx = the engine rejected the source (syntax); 5xx =
      // engine failure. Never echo the source; cap the detail.
      let detail: string | undefined;
      try {
        detail = (await response.text()).slice(0, MAX_DETAIL_CHARS);
      } catch {
        detail = undefined;
      }
      const isClientError = response.status >= 400 && response.status < 500;
      throw new HermeticError(
        isClientError ? 'INVALID_SYNTAX' : 'RENDER_ERROR',
        isClientError
          ? 'The rendering engine rejected the source as invalid.'
          : `The rendering engine returned status ${response.status}.`,
        detail,
      );
    }

    const bytes = await readCapped(response, maxOutputBytes, controller.signal);
    const contentType =
      response.headers.get('content-type') ?? (output === 'svg' ? 'image/svg+xml' : 'image/png');
    return { bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}
