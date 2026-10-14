# DBML

Database Markup Language for relational schemas: tables, columns, keys, indexes and references, rendered offline as an entity-relationship diagram (SVG). Icon set {{AWS_ICONS_VERSION}} applies to PlantUML only.

## When to use

- Documenting a relational schema: tables, primary/foreign keys and relationships.
- Reviewing a migration or a data model before writing SQL.
- For conceptual ER diagrams without column types, `erd` is lighter.

## Building blocks

- Tables: `Table users { id int [pk, increment] … }`; column settings in brackets: `pk`,
  `not null`, `unique`, `default: 0`, `note: 'text'`, `increment`.
- Inline references: `user_id int [ref: > users.id]` (`>` many-to-one, `<` one-to-many,
  `-` one-to-one, `<>` many-to-many).
- Standalone references: `Ref: orders.user_id > users.id`.
- Enums: `Enum order_status { pending paid shipped }`, then use the enum as a column type.
- Indexes: `indexes { (user_id, created_at) [name: 'idx_user_created'] }` inside a table.
- Notes: `Note: 'text'` on tables; table groups `TableGroup billing { orders payments }`.
- Output: SVG only in this server.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| Any `http(s)` or file address anywhere in the source (including in notes) | Remote fetch / file read | Plain text in notes; keep the whole schema in one source |
| `output=png` for DBML | Not supported by the bundled engine | `output=svg` |

## Examples

Orders schema with references and an enum:

```hermetic-example format=dbml output=svg
Enum order_status {
  pending
  paid
  shipped
}

Table customers {
  id int [pk, increment]
  email varchar [unique, not null]
}

Table orders {
  id int [pk, increment]
  customer_id int [ref: > customers.id, not null]
  status order_status [default: 'pending']
  created_at timestamp
}

Table order_lines {
  order_id int [ref: > orders.id]
  sku varchar
  quantity int
  indexes {
    (order_id, sku) [pk]
  }
}
```

Standalone reference syntax:

```hermetic-example format=dbml output=svg
Table authors {
  id int [pk]
  name varchar
}

Table books {
  id int [pk]
  author_id int
  title varchar
}

Ref: books.author_id > authors.id
```
