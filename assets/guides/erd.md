# Erd

Plain-text entity-relationship diagrams: entities, attributes and cardinalities, laid out automatically. Rendered offline to SVG or PNG (icon set {{AWS_ICONS_VERSION}} applies to PlantUML only).

## When to use

- Conceptual or logical data models with entities, keys and cardinalities.
- Lightweight ER sketches without column types.
- For schemas with types, indexes and enums, use `dbml`.

## Building blocks

- Entities: a line `[Person]`; attributes follow on the next lines, one per line.
- Keys: prefix `*` for primary key, `+` for foreign key (`*+` for both).
- Relationships: `Person *--1 Address` using cardinality symbols on each side:
  `?` zero or one, `1` exactly one, `*` zero or more, `+` one or more.
- Relationship labels: `Person *--1 Address {label: "lives at"}`.
- Styling: header lines such as `title {label: "Orders"}` and entity options
  `[Person] {bgcolor: "#d0e0d0"}`.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| Any `http(s)` or file address anywhere in the source | Remote fetch / file read | Plain text labels |

## Examples

Orders model:

```hermetic-example format=erd output=svg
title {label: "Orders"}

[Customer]
*id
email

[Order]
*id
+customer_id
status

[OrderLine]
*+order_id
*sku
quantity

Customer 1--* Order {label: "places"}
Order 1--+ OrderLine
```

Minimal model, as PNG:

```hermetic-example format=erd output=png
[Author]
*id
name

[Book]
*id
+author_id
title

Author 1--* Book
```
