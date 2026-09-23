import { DOMParser, XMLSerializer, onErrorStopParsing } from '@xmldom/xmldom';
import { HermeticError } from '../errors.js';
/**
 * Output barrier (RN-11): the delivered SVG must emit no requests and run no code when displayed.
 * We parse with a **real XML parser** and rebuild against an **element allowlist** — anything not
 * explicitly known-safe (e.g. `script`, `foreignObject`, embedded HTML) is dropped, `on*` handlers
 * are stripped, and every `href`/`src`/`style` is neutralized unless it is a local fragment or an
 * inline `data:image/`. Fail-closed: if the SVG cannot be parsed with confidence, we refuse.
 *
 * Never regex-based (`plan.md` §5): the tree is walked structurally.
 */
const ELEMENT_NODE = 1;
/** Known-safe SVG elements. Everything else is removed, subtree and all. */
const ALLOWED_ELEMENTS = new Set([
    'svg', 'g', 'defs', 'symbol', 'use', 'switch', 'title', 'desc', 'metadata',
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'textpath', 'tref',
    'image', 'marker', 'pattern', 'clippath', 'mask', 'style', 'a',
    'lineargradient', 'radialgradient', 'stop',
    'filter', 'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite',
    'feconvolvematrix', 'fediffuselighting', 'fedisplacementmap', 'feflood',
    'fegaussianblur', 'feimage', 'femerge', 'femergenode', 'femorphology',
    'feoffset', 'fespecularlighting', 'fetile', 'feturbulence',
    'fedistantlight', 'fepointlight', 'fespotlight',
    'fefunca', 'fefuncb', 'fefuncg', 'fefuncr',
]);
/** Attribute (local) names that carry a resource reference and must be sanitized. */
const URL_ATTRS = new Set(['href', 'src']);
const EXTERNAL_URL = /(?:https?|ftps?|file|jar|netdoc|smb|gopher):/i;
function isSafeReference(value) {
    const trimmed = value.trim();
    // Local fragment references (`#id`) and inline raster data are safe — no network, no script.
    return trimmed.startsWith('#') || /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(trimmed);
}
/** Strip `@import`, external `url(...)`, and script-y CSS from a style value or <style> text. */
function sanitizeCss(css) {
    return css
        .replace(/@import[^;]*;?/gi, '')
        .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, _q, inner) => isSafeReference(inner) ? match : 'none')
        .replace(/expression\s*\(/gi, 'void(')
        .replace(/javascript:/gi, '');
}
function sanitizeElement(el) {
    // Snapshot attribute names first — removing while iterating the live map skips entries.
    const attrNames = [];
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes.item(i);
        if (attr)
            attrNames.push(attr.name);
    }
    for (const name of attrNames) {
        const lower = name.toLowerCase();
        const localName = lower.includes(':') ? lower.slice(lower.indexOf(':') + 1) : lower;
        // Event handlers — match on the local name so a namespace-prefixed `x:onload` is caught too.
        if (localName.startsWith('on')) {
            el.removeAttribute(name);
            continue;
        }
        // Resource references: keep only local fragments / inline data images.
        if (URL_ATTRS.has(localName)) {
            const value = el.getAttribute(name) ?? '';
            if (!isSafeReference(value))
                el.removeAttribute(name);
            continue;
        }
        // Inline styles may hide external url()/@import/javascript:.
        if (localName === 'style') {
            const value = el.getAttribute(name) ?? '';
            el.setAttribute(name, sanitizeCss(value));
            continue;
        }
        // Any remaining attribute whose value smuggles an external scheme.
        const value = el.getAttribute(name) ?? '';
        if (EXTERNAL_URL.test(value))
            el.removeAttribute(name);
    }
}
function walk(node) {
    const children = [];
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes.item(i);
        if (child)
            children.push(child);
    }
    for (const child of children) {
        if (child.nodeType !== ELEMENT_NODE)
            continue;
        const el = child;
        const tag = (el.localName ?? el.nodeName).toLowerCase();
        if (!ALLOWED_ELEMENTS.has(tag)) {
            node.removeChild(child);
            continue;
        }
        sanitizeElement(el);
        if (tag === 'style' && el.textContent) {
            el.textContent = sanitizeCss(el.textContent);
        }
        walk(child);
    }
}
/**
 * Sanitize a rendered SVG string. Returns clean SVG markup (the `<svg>` root only — no XML
 * declaration or DOCTYPE). Throws {@link HermeticError} `RENDER_ERROR` if the input cannot be
 * parsed safely (fail-closed).
 */
export function sanitizeSvg(svg) {
    let doc;
    try {
        doc = new DOMParser({ onError: onErrorStopParsing }).parseFromString(svg, 'image/svg+xml');
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : 'parse error';
        throw new HermeticError('RENDER_ERROR', 'Could not safely sanitize the rendered SVG.', reason);
    }
    const root = doc.documentElement;
    if (!root || root.localName?.toLowerCase() !== 'svg') {
        throw new HermeticError('RENDER_ERROR', 'Rendered output is not a valid SVG document.');
    }
    // Sanitize the root's own attributes, then its subtree.
    sanitizeElement(root);
    walk(root);
    return new XMLSerializer().serializeToString(root);
}
