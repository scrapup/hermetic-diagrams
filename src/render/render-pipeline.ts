import { KROKI_DIAGRAM_TYPE } from '../domain.js';
import type { HermeticConfig } from '../config.js';
import { HermeticError } from '../errors.js';
import { logger } from '../logger.js';
import { validateFormat } from '../pep/format-validator.js';
import { validateSyntax } from '../pep/syntax-validator.js';
import { scanSecurity } from '../pep/security-scanner.js';
import { renderWithKroki, type FetchLike } from './kroki-client.js';
import { sanitizeSvg } from './svg-sanitizer.js';
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

export async function renderDiagram(
  request: RenderRequest,
  deps: RenderPipelineDeps,
): Promise<RenderOutcome> {
  const started = performance.now();

  // Barrier 1: PEP — allowlist, syntax, security (in this order).
  const { format, output } = validateFormat({ format: request.format, output: request.output });

  if (typeof request.source !== 'string') {
    throw new HermeticError('EMPTY_CONTENT', 'The diagram source must be a non-empty string.');
  }
  const source = request.source;

  validateSyntax(format, source);
  scanSecurity(format, source, deps.config.maxSourceBytes);

  // Guard + engine: render under the concurrency limit against the internal Kroki.
  const { bytes } = await deps.guard.run(() =>
    renderWithKroki(
      {
        baseUrl: deps.config.krokiBaseUrl,
        diagramType: KROKI_DIAGRAM_TYPE[format],
        output,
        source,
        timeoutMs: deps.config.renderTimeoutMs,
        maxOutputBytes: deps.config.maxOutputBytes,
      },
      deps.fetchImpl,
    ),
  );

  const durationMs = Math.round(performance.now() - started);
  logger.info('render.ok', { format, output, durationMs });

  // Output barrier: sanitize SVG; PNG is raster and returned as base64.
  if (output === 'svg') {
    const clean = sanitizeSvg(Buffer.from(bytes).toString('utf8'));
    return { format: 'svg', mimeType: 'image/svg+xml', encoding: 'utf8', data: clean };
  }
  return {
    format: 'png',
    mimeType: 'image/png',
    encoding: 'base64',
    data: Buffer.from(bytes).toString('base64'),
  };
}
