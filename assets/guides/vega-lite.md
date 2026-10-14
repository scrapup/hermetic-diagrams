# Vega-Lite

High-level chart grammar in JSON: data, a mark and encodings, with sensible defaults for scales and axes. Rendered offline to SVG with the data inlined (icon set {{AWS_ICONS_VERSION}} applies to PlantUML only).

## When to use

- Bar, line, area, point, heatmap and stacked charts from small tabular data.
- Quick metrics visuals in design docs and incident reviews.
- Switch to `vega` only when you need marks or layouts Vega-Lite cannot express.

## Building blocks

- The source is one JSON object (well-formed JSON; no comments).
- `data`: **inline** rows `{"values": [ … ]}`.
- `mark`: `bar`, `line`, `area`, `point`, `rect`, `tick`, `arc`, or an object
  `{"type": "line", "point": true}`.
- `encoding`: channels `x`, `y`, `color`, `size`, `theta`, `tooltip`, each with `field` and
  `type` (`quantitative`, `nominal`, `ordinal`, `temporal`), optional `aggregate`, `title`, `sort`.
- `transform`: `filter`, `calculate`, `aggregate`, `fold`.
- Composition: `layer`, `hconcat`, `vconcat`, `facet`; `width` / `height` / `title`.
- The `$schema` line is optional and not needed here; omit it.
- Output: SVG only in this server.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| `data.url` (remote CSV/JSON) and any other `url` property | Remote fetch | Inline rows in `data.values` |
| Any string value carrying an `http(s)` or file address (other than `$schema`) | Remote fetch | Literal values |
| `output=png` for Vega-Lite | Not supported by the bundled engine | `output=svg` |

## Examples

Grouped bar chart:

```hermetic-example format=vega-lite output=svg
{
  "title": "Errors per service",
  "data": {
    "values": [
      {"service": "orders", "env": "prd", "errors": 12},
      {"service": "orders", "env": "dev", "errors": 30},
      {"service": "billing", "env": "prd", "errors": 4},
      {"service": "billing", "env": "dev", "errors": 9}
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "service", "type": "nominal"},
    "xOffset": {"field": "env"},
    "y": {"field": "errors", "type": "quantitative"},
    "color": {"field": "env", "type": "nominal"}
  }
}
```

Line chart with points:

```hermetic-example format=vega-lite output=svg
{
  "data": {
    "values": [
      {"week": 1, "p95": 180},
      {"week": 2, "p95": 160},
      {"week": 3, "p95": 140},
      {"week": 4, "p95": 150}
    ]
  },
  "mark": {"type": "line", "point": true},
  "encoding": {
    "x": {"field": "week", "type": "ordinal"},
    "y": {"field": "p95", "type": "quantitative", "title": "p95 latency (ms)"}
  }
}
```
