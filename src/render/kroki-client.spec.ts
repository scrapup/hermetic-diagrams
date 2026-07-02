import { describe, it, expect } from 'vitest';
import { renderWithKroki, type FetchLike } from './kroki-client.js';
import { HermeticError } from '../errors.js';

const base = {
  baseUrl: 'http://kroki:8000',
  diagramType: 'plantuml',
  output: 'svg' as const,
  source: '@startuml\nA->B\n@enduml',
  timeoutMs: 1000,
  maxOutputBytes: 1024,
};

describe('renderWithKroki', () => {
  it('POSTs the source in the body to the correct URL (never GET)', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchImpl: FetchLike = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response('<svg>ok</svg>', {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      });
    };

    const result = await renderWithKroki(base, fetchImpl);
    expect(capturedUrl).toBe('http://kroki:8000/plantuml/svg');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.body).toBe(base.source);
    expect(Buffer.from(result.bytes).toString('utf8')).toBe('<svg>ok</svg>');
    expect(result.contentType).toBe('image/svg+xml');
  });

  it('maps a non-2xx response to RENDER_ERROR with a detail', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response('syntax error at line 1', { status: 400 });
    try {
      await renderWithKroki(base, fetchImpl);
    } catch (err) {
      expect(err).toBeInstanceOf(HermeticError);
      expect((err as HermeticError).code).toBe('RENDER_ERROR');
      expect((err as HermeticError).detail).toContain('syntax error');
      return;
    }
    throw new Error('expected rejection');
  });

  it('rejects output larger than the cap via Content-Length', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response('x'.repeat(50), { status: 200, headers: { 'content-length': '5000' } });
    await expect(renderWithKroki({ ...base, maxOutputBytes: 100 }, fetchImpl)).rejects.toBeInstanceOf(
      HermeticError,
    );
  });

  it('rejects output larger than the cap while streaming (no Content-Length)', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(60));
        controller.enqueue(new Uint8Array(60));
        controller.close();
      },
    });
    const fetchImpl: FetchLike = async () => new Response(stream, { status: 200 });
    await expect(renderWithKroki({ ...base, maxOutputBytes: 100 }, fetchImpl)).rejects.toBeInstanceOf(
      HermeticError,
    );
  });

  it('maps an aborted request to RENDER_TIMEOUT', async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init.signal;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    try {
      await renderWithKroki({ ...base, timeoutMs: 20 }, fetchImpl);
    } catch (err) {
      expect((err as HermeticError).code).toBe('RENDER_TIMEOUT');
      return;
    }
    throw new Error('expected timeout');
  });

  it('maps a transport failure to RENDER_ERROR', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    try {
      await renderWithKroki(base, fetchImpl);
    } catch (err) {
      expect((err as HermeticError).code).toBe('RENDER_ERROR');
      return;
    }
    throw new Error('expected rejection');
  });
});
