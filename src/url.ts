const SLASH = 0x2f;

/** Drop every trailing `/` — a linear scan instead of a backtracking `/\/+$/` regex. */
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === SLASH) end--;
  return value.slice(0, end);
}
