import { isInputFormat, isOutputFormat, type DiagramFormat, type OutputFormat } from '../domain.js';

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

const FENCE = '```';
const INFO = 'hermetic-example';

function parseInfo(info: string, line: number): { format: DiagramFormat; output: OutputFormat } {
  const attrs = new Map<string, string>();
  for (const token of info.split(/\s+/).filter((t) => t.length > 0)) {
    const match = /^([a-z]+)=([a-z0-9-]+)$/.exec(token);
    if (match === null) throw new Error(`line ${line}: malformed attribute "${token}"`);
    const [, key = '', value = ''] = match;
    if (key !== 'format' && key !== 'output') throw new Error(`line ${line}: unknown attribute "${key}"`);
    if (attrs.has(key)) throw new Error(`line ${line}: duplicated attribute "${key}"`);
    attrs.set(key, value);
  }
  const format = attrs.get('format');
  const output = attrs.get('output');
  if (format === undefined || !isInputFormat(format)) throw new Error(`line ${line}: missing or unknown format`);
  if (output === undefined || !isOutputFormat(output)) throw new Error(`line ${line}: missing or unknown output`);
  return { format, output };
}

/** Body lines from `start` up to the closing fence; `end` is the fence's index. */
function readBlock(lines: readonly string[], start: number): { body: string[]; end: number } {
  const end = lines.indexOf(FENCE, start);
  if (end === -1) throw new Error('unterminated hermetic-example block');
  return { body: lines.slice(start, end), end };
}

export function extractExamples(markdown: string): GuideExample[] {
  const lines = markdown.split(/\r?\n/);
  const examples: GuideExample[] = [];
  let i = 0;
  while (i < lines.length) {
    const opening = lines[i] ?? '';
    const openingLine = i + 1;
    if (!opening.startsWith(`${FENCE}${INFO}`)) {
      i += 1;
      continue;
    }
    const rest = opening.slice(FENCE.length + INFO.length);
    if (rest.length > 0 && !/^\s/.test(rest)) throw new Error(`line ${openingLine}: malformed info string`);
    const { format, output } = parseInfo(rest.trim(), openingLine);
    const { body, end } = readBlock(lines, i + 1);
    examples.push({ format, output, source: body.join('\n'), line: openingLine });
    i = end + 1;
  }
  return examples;
}
