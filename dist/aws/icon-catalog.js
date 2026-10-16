/**
 * Icon Catalog (aws-icons `plan.md` §4.2): a read-only search over the verified, in-memory icon set
 * behind `list_aws_icons`. Macro names are derived from the file name following the upstream
 * convention (`<Name>`, `<Name>Participant`; groups `<Name>Group`) — never parsed from content.
 */
export const DEFAULT_ICON_LIMIT = 50;
export const MAX_ICON_LIMIT = 200;
export const MAX_QUERY_CHARS = 64;
function compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
export function includeLine(path) {
    return `!include AWSPuml/${path}`;
}
export function macrosFor(category, name) {
    if (category === 'Groups')
        return [`${name}Group(alias, label)`];
    return [`${name}(alias, label, technology)`, `${name}Participant(alias, label, technology)`];
}
function baseIncludes(iconSet) {
    const roots = [...iconSet.files.keys()].filter((p) => !p.includes('/')).sort(compare);
    const common = roots.filter((p) => p === 'AWSCommon.puml');
    return [...common, ...roots.filter((p) => p !== 'AWSCommon.puml')].map(includeLine);
}
export function searchIcons(iconSet, search) {
    const categories = [...iconSet.categories.keys()].sort(compare);
    const wantedCategory = search.category?.toLowerCase();
    const query = search.query?.toLowerCase();
    const all = [];
    const matches = [];
    for (const category of categories) {
        for (const path of iconSet.categories.get(category) ?? []) {
            const name = path.slice(category.length + 1, -'.puml'.length);
            const icon = { category, name, include: includeLine(path), macros: macrosFor(category, name) };
            all.push(icon);
            if (wantedCategory !== undefined && category.toLowerCase() !== wantedCategory)
                continue;
            if (query !== undefined && !name.toLowerCase().includes(query))
                continue;
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
