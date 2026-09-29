import { describe, it, expect } from 'vitest';
import { createRenderDiagramHandler } from './render-diagram.js';
import { loadConfig } from '../../config.js';
import { ConcurrencyGuard } from '../../render/concurrency.js';
import type { FetchLike } from '../../render/kroki-client.js';
import type { RenderPipelineDeps } from '../../render/render-pipeline.js';

function deps(fetchImpl: FetchLike): RenderPipelineDeps {
  return { config: loadConfig(), guard: new ConcurrencyGuard(2), fetchImpl };
}

const svgWithScript =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';

describe('render_diagram handler', () => {
  it('renders a valid PlantUML source to sanitized SVG', async () => {
    const handler = createRenderDiagramHandler(
      deps(async () => new Response(svgWithScript, { status: 200 })),
    );
    const result = await handler({ format: 'plantuml', source: '@startuml\nA->B\n@enduml' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toMatchObject({ type: 'text' });
    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toMatch(/script/i);
    expect(text).toMatch(/rect/);
    expect(result.structuredContent).toMatchObject({ format: 'svg', mimeType: 'image/svg+xml' });
  });

  it('renders PNG as a base64 image content block', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const handler = createRenderDiagramHandler(
      deps(async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })),
    );
    const result = await handler({ format: 'd2', source: 'a -> b', output: 'png' });

    expect(result.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' });
    expect(result.structuredContent).toMatchObject({ format: 'png', encoding: 'base64' });
  });

  it('returns INVALID_FORMAT for an unknown format without calling Kroki', async () => {
    let called = false;
    const handler = createRenderDiagramHandler(
      deps(async () => {
        called = true;
        return new Response('x');
      }),
    );
    const result = await handler({ format: 'nope', source: 'x' });
    expect(called).toBe(false);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: 'INVALID_FORMAT' } });
  });

  it('returns EXTERNAL_REFERENCE for a source with a remote include, without calling Kroki', async () => {
    let called = false;
    const handler = createRenderDiagramHandler(
      deps(async () => {
        called = true;
        return new Response('x');
      }),
    );
    const result = await handler({
      format: 'plantuml',
      source: '@startuml\n!includeurl https://evil.test/x\n@enduml',
    });
    expect(called).toBe(false);
    expect(result.structuredContent).toMatchObject({ error: { code: 'EXTERNAL_REFERENCE' } });
  });

  it('maps a Kroki 4xx to INVALID_SYNTAX', async () => {
    const handler = createRenderDiagramHandler(
      deps(async () => new Response('bad syntax', { status: 400 })),
    );
    const result = await handler({ format: 'graphviz', source: 'digraph { a -> b }' });
    expect(result.structuredContent).toMatchObject({ error: { code: 'INVALID_SYNTAX' } });
  });
});
