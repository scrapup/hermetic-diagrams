# Vega

Low-level visualization grammar in JSON: you declare data, scales, axes and marks explicitly. Rendered offline to SVG with the data inlined (icon set {{AWS_ICONS_VERSION}} applies to PlantUML only).

## When to use

- Custom charts that need explicit control over scales, marks and layout.
- Most bar/line/point charts are shorter in `vega-lite`; use Vega when Vega-Lite cannot
  express the chart.

## Building blocks

- The source is one JSON object (well-formed JSON; no comments).
- `width`, `height`, `padding` set the canvas.
- `data`: named datasets with **inline** rows: `{"name": "table", "values": [ … ]}`;
  transforms such as `filter`, `aggregate`, `formula` run on them.
- `scales`: `band`, `linear`, `ordinal`, `time`, mapping `domain` (from data fields) to `range`
  (`"width"`, `"height"`, or a color scheme).
- `axes`: `{"orient": "bottom", "scale": "x"}`; `legends` for color/size scales.
- `marks`: `rect`, `line`, `symbol`, `area`, `text`, `rule`, with `from.data` and `encode.enter`
  / `encode.update` property sets.
- The `$schema` line is optional and not needed here; omit it.
- Output: SVG only in this server.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| Any `url` property (remote data files, images) | Remote fetch | Inline rows in `data[].values` |
| Any string value carrying an `http(s)` or file address (other than `$schema`) | Remote fetch | Literal values |
| `output=png` for Vega | Not supported by the bundled engine | `output=svg` |

## Examples

Bar chart with inline data:

```hermetic-example format=vega output=svg
{
  "width": 300,
  "height": 160,
  "padding": 5,
  "data": [
    {
      "name": "table",
      "values": [
        {"service": "orders", "p95": 120},
        {"service": "billing", "p95": 85},
        {"service": "search", "p95": 210}
      ]
    }
  ],
  "scales": [
    {"name": "x", "type": "band", "domain": {"data": "table", "field": "service"}, "range": "width", "padding": 0.2},
    {"name": "y", "type": "linear", "domain": {"data": "table", "field": "p95"}, "range": "height", "nice": true}
  ],
  "axes": [
    {"orient": "bottom", "scale": "x"},
    {"orient": "left", "scale": "y", "title": "p95 latency (ms)"}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "table"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "service"},
          "width": {"scale": "x", "band": 1},
          "y": {"scale": "y", "field": "p95"},
          "y2": {"scale": "y", "value": 0},
          "fill": {"value": "steelblue"}
        }
      }
    }
  ]
}
```

Line chart:

```hermetic-example format=vega output=svg
{
  "width": 300,
  "height": 120,
  "data": [
    {
      "name": "series",
      "values": [
        {"day": 1, "requests": 120},
        {"day": 2, "requests": 180},
        {"day": 3, "requests": 150},
        {"day": 4, "requests": 220}
      ]
    }
  ],
  "scales": [
    {"name": "x", "type": "linear", "domain": {"data": "series", "field": "day"}, "range": "width"},
    {"name": "y", "type": "linear", "domain": {"data": "series", "field": "requests"}, "range": "height", "nice": true}
  ],
  "axes": [
    {"orient": "bottom", "scale": "x", "title": "day"},
    {"orient": "left", "scale": "y"}
  ],
  "marks": [
    {
      "type": "line",
      "from": {"data": "series"},
      "encode": {
        "enter": {
          "x": {"scale": "x", "field": "day"},
          "y": {"scale": "y", "field": "requests"},
          "stroke": {"value": "darkorange"}
        }
      }
    }
  ]
}
```
