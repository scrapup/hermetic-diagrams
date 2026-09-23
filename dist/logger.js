/**
 * Structured local logging to **stderr only**. stdout is reserved for the MCP protocol (stdio
 * transport), so anything written there would corrupt the JSON-RPC stream.
 *
 * Containment invariant (RN-07): the diagram source must never appear in a log. This module has no
 * transport other than stderr — there is no external log sink — and callers pass only codes,
 * formats, and durations, never the source text.
 */
function emit(level, event, fields) {
    const record = { level, event, ...fields };
    // Serialize defensively: a logging failure must never crash a render.
    try {
        process.stderr.write(`${JSON.stringify(record)}\n`);
    }
    catch {
        process.stderr.write(`${level} ${event}\n`);
    }
}
export const logger = {
    info(event, fields = {}) {
        emit('info', event, fields);
    },
    warn(event, fields = {}) {
        emit('warn', event, fields);
    },
    error(event, fields = {}) {
        emit('error', event, fields);
    },
};
