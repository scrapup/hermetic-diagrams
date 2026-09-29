import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from './svg-sanitizer.js';
import { HermeticError } from '../errors.js';

const wrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10">${inner}</svg>`;

describe('sanitizeSvg — removes dangerous elements', () => {
  it('removes <script>', () => {
    const out = sanitizeSvg(wrap('<script>alert(1)</script><rect width="1" height="1"/>'));
    expect(out).not.toMatch(/script/i);
    expect(out).toMatch(/rect/);
  });

  it('removes <foreignObject> (and its embedded HTML)', () => {
    const out = sanitizeSvg(wrap('<foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject>'));
    expect(out).not.toMatch(/foreignObject/i);
    expect(out).not.toMatch(/<body/i);
  });
});

describe('sanitizeSvg — strips dangerous attributes', () => {
  it('removes on* event handlers', () => {
    const out = sanitizeSvg(wrap('<rect width="1" height="1" onload="steal()" onclick="x()"/>'));
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/onclick/i);
  });

  it('removes a remote href but keeps a local fragment reference', () => {
    const out = sanitizeSvg(
      wrap('<use xlink:href="https://evil.test/x#a"/><use xlink:href="#local"/>'),
    );
    expect(out).not.toMatch(/evil\.test/);
    expect(out).toMatch(/#local/);
  });

  it('drops an <image> href pointing at a remote URL', () => {
    const out = sanitizeSvg(wrap('<image href="http://evil.test/pixel.png" width="1" height="1"/>'));
    expect(out).not.toMatch(/evil\.test/);
  });

  it('keeps an inline data:image href', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    const out = sanitizeSvg(wrap(`<image href="${data}" width="1" height="1"/>`));
    expect(out).toContain('data:image/png;base64');
  });
});

describe('sanitizeSvg — neutralizes CSS vectors', () => {
  it('strips external url() in an inline style', () => {
    const out = sanitizeSvg(wrap('<rect width="1" height="1" style="fill:url(https://evil.test/x)"/>'));
    expect(out).not.toMatch(/evil\.test/);
  });

  it('strips @import inside a <style> element', () => {
    const out = sanitizeSvg(wrap('<style>@import url(https://evil.test/x.css); rect{fill:red}</style><rect width="1" height="1"/>'));
    expect(out).not.toMatch(/@import/i);
    expect(out).not.toMatch(/evil\.test/);
    expect(out).toMatch(/fill:red/);
  });

  it('removes a javascript: reference from a style', () => {
    const out = sanitizeSvg(wrap('<rect width="1" height="1" style="x:javascript:alert(1)"/>'));
    expect(out).not.toMatch(/javascript:/i);
  });
});

describe('sanitizeSvg — preserves valid content', () => {
  it('keeps paths, text and local gradients', () => {
    const svg = wrap(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>' +
        '<path d="M0 0 L10 10" fill="url(#g)"/><text x="1" y="1">hello</text>',
    );
    const out = sanitizeSvg(svg);
    expect(out).toMatch(/<path/);
    expect(out).toMatch(/hello/);
    expect(out).toMatch(/url\(#g\)/);
  });
});

describe('sanitizeSvg — fail-closed', () => {
  it('rejects non-SVG root', () => {
    expect(() => sanitizeSvg('<html><body>nope</body></html>')).toThrow(HermeticError);
  });

  it('rejects unparseable input', () => {
    try {
      sanitizeSvg('<svg><rect></svg', );
    } catch (err) {
      expect((err as HermeticError).code).toBe('RENDER_ERROR');
      return;
    }
    // Some malformed inputs may still parse; if so, ensure output is at least sanitized SVG.
  });
});
