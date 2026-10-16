/**
 * Sanitize a rendered SVG string. Returns clean SVG markup (the `<svg>` root only — no XML
 * declaration or DOCTYPE). Throws {@link HermeticError} `RENDER_ERROR` if the input cannot be
 * parsed safely (fail-closed).
 */
export declare function sanitizeSvg(svg: string): string;
