# PlantUML

General-purpose UML and diagram-as-text notation (sequence, class, activity, component, state, use case, deployment). Rendered offline; AWS icons use the reserved `AWSPuml/` prefix (icon set {{AWS_ICONS_VERSION}}).

## When to use

- Interactions over time between participants: **sequence** diagrams.
- Structure: **class**, **component**, **deployment** and **object** diagrams.
- Behaviour: **activity** and **state** diagrams, **use case** diagrams.
- Architecture with AWS service icons: start from `aws-architecture`, `aws-sequence` or
  `aws-simplified` instead (call `get_authoring_guide`). Context/container views: `c4`.

## Building blocks

- Every diagram is one `@startuml` … `@enduml` block; start and end markers must balance.
- Sequence: `participant`, `actor`, `database`, `queue`; messages `A -> B : text`, replies
  `A --> B`, self calls `A -> A`; grouping with `alt` / `else` / `end`, `loop`, `group`;
  `activate` / `deactivate`; `== separator ==`; `note left of A : text`.
- Class: `class`, `interface`, `enum`, `abstract class`; members inside `{ }`; relations
  `<|--` (inheritance), `*--` (composition), `o--` (aggregation), `-->` (association) with
  multiplicities `"1" -- "*"`.
- Activity (new syntax): `start`, `:action;`, `if (cond?) then (yes)` … `else (no)` … `endif`,
  `while (cond?)` … `endwhile`, `fork` / `fork again` / `end fork`, `stop`; swimlanes `|Lane|`.
- Component/deployment: `component`, `node`, `database`, `cloud`, `package { }`, `[Comp] --> [Other]`.
- Styling: `skinparam` (for example `skinparam monochrome true`), `title`, `legend`, `left to right direction`.
- Bundled standard library: `!include <C4/C4_Container>` and the other `<…>` stdlib entries
  ship with the engine and are resolved locally.
- Preprocessor: variables `!$name = "value"`, procedures `!procedure $box($x)` … `!endprocedure`.
  Keep everything in the one source: there is no file system or network to read from.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| `!includeurl`, or `!include` / `!includesub` of an `http(s)` address | Remote fetch | Paste the content inline, or use a bundled stdlib include `!include <…>` |
| AWS icons by internet address (`raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/…`) and `!define AWSPuml <address>` | Remote fetch / redefinition | `!include AWSPuml/AWSCommon.puml` then `!include AWSPuml/<Category>/<Icon>.puml` (see `list_aws_icons`) |
| Themes loaded from an address (`from` + URL) | Remote fetch | `skinparam` settings in the source |
| Sprites or images by address (`<img:` + URL) | Remote fetch | Inline `sprite $name [WxH/16z] { … }`, or AWS icons via `AWSPuml/` |
| Environment reads (`getenv`), DTD/entity declarations | Data leak / XXE | Literal values in the source |
| Unbalanced `@startuml` / `@enduml` | Invalid syntax | One balanced block per diagram |

## Examples

Sequence with an alternative path:

```hermetic-example format=plantuml output=svg
@startuml
actor User as u
participant "API" as api
database "Orders DB" as db
u -> api : POST /orders
activate api
api -> db : insert order
alt stock available
  db --> api : order id
  api --> u : 201 Created
else out of stock
  api --> u : 409 Conflict
end
deactivate api
@enduml
```

Activity diagram with swimlanes, as PNG:

```hermetic-example format=plantuml output=png
@startuml
|Customer|
start
:Submit order;
|Service|
if (Payment authorised?) then (yes)
  :Reserve stock;
  :Confirm order;
else (no)
  :Reject order;
endif
|Customer|
:Receive confirmation;
stop
@enduml
```

Class diagram:

```hermetic-example format=plantuml output=svg
@startuml
interface Repository {
  +save(order: Order): void
}
class Order {
  +id: string
  +total: number
}
class OrderLine {
  +sku: string
  +quantity: number
}
class SqlRepository
Repository <|.. SqlRepository
Order "1" *-- "1..*" OrderLine
SqlRepository --> Order
@enduml
```
