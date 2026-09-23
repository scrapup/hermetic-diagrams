import { HermeticError } from '../errors.js';
/** Max chars of a Kroki error body echoed back as `detail` (never the source). */
const MAX_DETAIL_CHARS = 500;
function outputTooLarge(maxOutputBytes) {
    return new HermeticError('TOO_LARGE', `Rendered output exceeds ${maxOutputBytes} bytes.`);
}
/** A promise that rejects with RENDER_TIMEOUT the moment `signal` aborts (or immediately if already). */
function abortAsTimeout(signal, timeoutMs) {
    return new Promise((_resolve, reject) => {
        const fail = () => reject(new HermeticError('RENDER_TIMEOUT', `Render exceeded ${timeoutMs} ms and was aborted.`));
        if (signal.aborted) {
            fail();
            return;
        }
        signal.addEventListener('abort', fail, { once: true });
    });
}
async function readCapped(response, maxOutputBytes, signal, timeoutMs) {
    const declared = response.headers.get('content-length');
    if (declared !== null && Number(declared) > maxOutputBytes) {
        throw outputTooLarge(maxOutputBytes);
    }
    const body = response.body;
    if (body === null) {
        // Race the buffered read against the timeout so a hung body still aborts.
        const buf = new Uint8Array(await Promise.race([response.arrayBuffer(), abortAsTimeout(signal, timeoutMs)]));
        if (buf.byteLength > maxOutputBytes)
            throw outputTooLarge(maxOutputBytes);
        return buf;
    }
    // `Response.body` is typed as `ReadableStream<any>` in the DOM lib; narrow to bytes.
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    try {
        for (;;) {
            // Race each read against the abort: a hung body (stream ignoring abort) still yields
            // RENDER_TIMEOUT deterministically, and the slot is released via the finally below.
            const { done, value } = await Promise.race([reader.read(), abortAsTimeout(signal, timeoutMs)]);
            if (done)
                break;
            if (value) {
                total += value.byteLength;
                if (total > maxOutputBytes)
                    throw outputTooLarge(maxOutputBytes);
                chunks.push(value);
            }
        }
    }
    finally {
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
export async function renderWithKroki(params, fetchImpl = fetch) {
    const { baseUrl, diagramType, output, source, timeoutMs, maxOutputBytes } = params;
    const url = `${baseUrl.replace(/\/+$/, '')}/${diagramType}/${output}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let response;
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
        }
        catch (err) {
            if (controller.signal.aborted) {
                throw new HermeticError('RENDER_TIMEOUT', `Render exceeded ${timeoutMs} ms and was aborted.`);
            }
            const reason = err instanceof Error ? err.message : 'unknown transport error';
            throw new HermeticError('RENDER_ERROR', 'Failed to reach the rendering engine.', reason);
        }
        if (!response.ok) {
            // Kroki returns a plaintext diagnostic. 4xx = the engine rejected the source (syntax); 5xx =
            // engine failure. Never echo the source; cap the detail.
            let detail;
            try {
                detail = (await response.text()).slice(0, MAX_DETAIL_CHARS);
            }
            catch {
                detail = undefined;
            }
            const isClientError = response.status >= 400 && response.status < 500;
            throw new HermeticError(isClientError ? 'INVALID_SYNTAX' : 'RENDER_ERROR', isClientError
                ? 'The rendering engine rejected the source as invalid.'
                : `The rendering engine returned status ${response.status}.`, detail);
        }
        let bytes;
        try {
            bytes = await readCapped(response, maxOutputBytes, controller.signal, timeoutMs);
        }
        catch (err) {
            // A raw AbortError from the stream (if it beat the race) still maps to a timeout.
            if (!(err instanceof HermeticError) && controller.signal.aborted) {
                throw new HermeticError('RENDER_TIMEOUT', `Render exceeded ${timeoutMs} ms and was aborted.`);
            }
            throw err;
        }
        const contentType = response.headers.get('content-type') ?? (output === 'svg' ? 'image/svg+xml' : 'image/png');
        return { bytes, contentType };
    }
    finally {
        clearTimeout(timer);
    }
}
