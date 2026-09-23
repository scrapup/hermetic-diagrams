import { INPUT_FORMATS, OUTPUT_FORMATS, isInputFormat, isOutputFormat, } from '../domain.js';
import { HermeticError } from '../errors.js';
/**
 * Notations Kroki supports but that are **out of the MVP scope** (they need browser/Chromium
 * companions, RN-05). Distinguished from truly unknown formats so the requester gets an accurate
 * message ("deferred" vs "unknown").
 */
const DEFERRED_FORMATS = new Set([
    'mermaid',
    'bpmn',
    'excalidraw',
    'bytefield',
    'nomnoml',
    'wavedrom',
    'structurizr',
    'diagramsnet',
]);
/**
 * Barrier 1, step 1 (`plan.md` §5.2): allowlist the input notation and the output format.
 * `output` defaults to `svg`. Anything outside the allowlists is rejected before any other work.
 */
export function validateFormat(input) {
    const { format, output } = input;
    if (typeof format !== 'string' || format.trim() === '') {
        throw new HermeticError('INVALID_FORMAT', `Missing "format". Supported formats: ${INPUT_FORMATS.join(', ')}.`);
    }
    const normalizedFormat = format.trim().toLowerCase();
    if (!isInputFormat(normalizedFormat)) {
        if (DEFERRED_FORMATS.has(normalizedFormat)) {
            throw new HermeticError('INVALID_FORMAT', `Format "${normalizedFormat}" is not available in this MVP cycle (it requires browser components). Supported formats: ${INPUT_FORMATS.join(', ')}.`);
        }
        throw new HermeticError('INVALID_FORMAT', `Unknown format "${normalizedFormat}". Supported formats: ${INPUT_FORMATS.join(', ')}.`);
    }
    let normalizedOutput = 'svg';
    if (output !== undefined) {
        if (typeof output !== 'string' || !isOutputFormat(output.trim().toLowerCase())) {
            const shown = typeof output === 'string' ? output : typeof output;
            throw new HermeticError('INVALID_FORMAT', `Unknown output "${shown}". Supported outputs: ${OUTPUT_FORMATS.join(', ')}.`);
        }
        normalizedOutput = output.trim().toLowerCase();
    }
    return { format: normalizedFormat, output: normalizedOutput };
}
