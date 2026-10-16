import type { IconSet } from './icon-set-store.js';

/**
 * Icon Catalog (aws-icons `plan.md` §4.2): a read-only search over the verified, in-memory icon set
 * behind `list_aws_icons`. Macro names are derived from the file name following the upstream
 * convention (`<Name>`, `<Name>Participant`; groups `<Name>Group`) — never parsed from content.
 */

export const DEFAULT_ICON_LIMIT = 50;
export const MAX_ICON_LIMIT = 200;
export const MAX_QUERY_CHARS = 64;

export interface IconSearch {
  readonly category?: string | undefined;
  readonly query?: string | undefined;
  readonly limit: number;
}

export interface CatalogIcon {
  readonly category: string;
  readonly name: string;
  readonly include: string;
  readonly macros: readonly string[];
}

export interface IconSearchResult {
  readonly version: string | null;
  /** Icons and groups in the shipped set. */
  readonly total: number;
  /** Icons and groups matching the filters (before `limit`). */
  readonly matched: number;
  readonly returned: number;
  readonly categories: readonly string[];
  readonly icons: readonly CatalogIcon[];
  /** Include lines of the base files (`AWSCommon.puml` first). */
  readonly base: readonly string[];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function includeLine(path: string): string {
  return `!include AWSPuml/${path}`;
}

export function macrosFor(category: string, name: string): string[] {
  if (category === 'Groups') return [`${name}Group(alias, label)`];
  return [`${name}(alias, label, technology)`, `${name}Participant(alias, label, technology)`];
}

function baseIncludes(iconSet: IconSet): string[] {
  const roots = [...iconSet.files.keys()].filter((p) => !p.includes('/')).sort(compare);
  const common = roots.filter((p) => p === 'AWSCommon.puml');
  return [...common, ...roots.filter((p) => p !== 'AWSCommon.puml')].map(includeLine);
}

export function searchIcons(iconSet: IconSet, search: IconSearch): IconSearchResult {
  const categories = [...iconSet.categories.keys()].sort(compare);
  const wantedCategory = search.category?.toLowerCase();
  const query = search.query?.toLowerCase();

  const all: CatalogIcon[] = [];
  const matches: CatalogIcon[] = [];
  for (const category of categories) {
    for (const path of iconSet.categories.get(category) ?? []) {
      const name = path.slice(category.length + 1, -'.puml'.length);
      const icon: CatalogIcon = { category, name, include: includeLine(path), macros: macrosFor(category, name) };
      all.push(icon);
      if (wantedCategory !== undefined && category.toLowerCase() !== wantedCategory) continue;
      if (query !== undefined && !name.toLowerCase().includes(query)) continue;
      matches.push(icon);
    }
  }
  matches.sort((a, b) => compare(a.category, b.category) || compare(a.name, b.name));
  const icons = matches.slice(0, search.limit);

  return {
    version: iconSet.version,
    total: all.length,
    matched: matches.length,
    returned: icons.length,
    categories,
    icons,
    base: baseIncludes(iconSet),
  };
}
