# Graphviz (DOT)

Graph description language for dependency graphs, state machines, trees and pipelines, laid out automatically by Graphviz. Rendered offline to SVG or PNG (icon set {{AWS_ICONS_VERSION}} applies to PlantUML only).

## When to use

- Dependency or call graphs, build pipelines, module maps.
- State machines and decision trees.
- Any graph where you want the layout engine to place nodes for you.
- Use `plantuml` for UML semantics and `c4` for architecture views.

## Building blocks

- A source declares `digraph name { … }` (directed) or `graph name { … }` (undirected);
  `strict` removes duplicate edges. Braces must balance.
- Nodes: `api [label="Orders API", shape=box]`; shapes `box`, `ellipse`, `cylinder`,
  `diamond`, `note`, `record`, `Mrecord`, `doublecircle`.
- Edges: `a -> b` (digraph) or `a -- b` (graph), with `[label="calls", style=dashed]`.
- Defaults: `node [shape=box, style=rounded]`, `edge [color=gray40]`, graph `rankdir=LR`.
- Clusters: `subgraph cluster_name { label="VPC"; a; b }` (the name must start with `cluster`).
- Ranks: `{ rank=same; a; b }`.
- HTML-like labels: `label=<<b>Orders</b><br/>API>`.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| `image=`, `imagepath=`, `shapefile=` with an `http(s)` address | Remote fetch | Built-in `shape=` kinds and HTML-like labels |
| Missing `graph` / `digraph` declaration, unbalanced braces | Invalid syntax | One `digraph { … }` block |

## Examples

Service dependency graph with clusters:

```hermetic-example format=graphviz output=svg
digraph services {
  rankdir=LR
  node [shape=box, style=rounded]
  subgraph cluster_public {
    label="Public"
    gateway [label="API Gateway"]
  }
  subgraph cluster_private {
    label="Private"
    orders [label="Orders"]
    billing [label="Billing"]
    db [label="Orders DB", shape=cylinder]
  }
  gateway -> orders
  orders -> billing [label="charge"]
  orders -> db
}
```

State machine, as PNG:

```hermetic-example format=graphviz output=png
digraph order_state {
  rankdir=LR
  node [shape=circle]
  created -> paid [label="pay"]
  paid -> shipped [label="ship"]
  created -> cancelled [label="cancel"]
  paid -> cancelled [label="refund"]
  shipped [shape=doublecircle]
  cancelled [shape=doublecircle]
}
```
