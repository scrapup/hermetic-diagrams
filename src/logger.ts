/**
 * Structured local logging to **stderr only**. stdout is reserved for the MCP protocol (stdio
 * transport), so anything written there would corrupt the JSON-RPC stream.
 *
 * Containment invariant (RN-07): the diagram source must never appear in a log. This module has no
 * transport other than stderr — there is no external log sink — and callers pass only codes,
 * formats, and durations, never the source text.
 */

type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  readonly [key: string]: string | number | boolean | undefined;
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const record: Record<string, unknown> = { level, event, ...fields };
  // Serialize defensively: a logging failure must never crash a render.
  try {
    process.stderr.write(`${JSON.stringify(record)}\n`);
  } catch {
    process.stderr.write(`${level} ${event}\n`);
  }
}

export const logger = {
  info(event: string, fields: LogFields = {}): void {
    emit('info', event, fields);
  },
  warn(event: string, fields: LogFields = {}): void {
    emit('warn', event, fields);
  },
  error(event: string, fields: LogFields = {}): void {
    emit('error', event, fields);
  },
};
