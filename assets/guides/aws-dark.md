# AWS diagrams in dark mode

Dark-background variant of the shipped AWS icon styles (icon set {{AWS_ICONS_VERSION}}): black background, light text and arrows, icons unchanged. Works with every AWS diagram kind (architecture, sequence, C4, simplified). Use the reserved `AWSPuml/` prefix.

## When to use

- Diagrams embedded in dark-themed documentation, dashboards or slides.
- Any of `aws-architecture`, `aws-sequence`, `aws-c4` or `aws-simplified`, rendered on black.

## Building blocks

- Set `!$AWS_DARK = true` **before** `!include AWSPuml/AWSCommon.puml`; the base file picks its
  colours when it is included, so setting it later has no effect.
- Alternatively set `!$PUML_MODE = "dark"` before `AWSCommon.puml`; it enables the same mode.
- Everything else is unchanged: icons, groups, entity and participant macros, `AWSSimplified`.
- Plain PlantUML elements you add keep their own colours; style them with `skinparam` if they
  must match (for example `skinparam ArrowColor #9BA7B6`).

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| Dark themes loaded from an address (`from` + URL) | Remote fetch | `!$AWS_DARK = true` before `AWSCommon.puml` |
| AWS icons by internet address or `!define AWSPuml <address>` | Remote fetch / redefinition | `!include AWSPuml/<path>` |
| Icon includes before `AWSCommon.puml` | Invalid order (`INVALID_SYNTAX`) | `!$AWS_DARK = true`, then `AWSCommon.puml`, then icons |

## Examples

Dark architecture with a group:

```hermetic-example format=plantuml output=svg
@startuml
!$AWS_DARK = true
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Groups/VPC.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/Database/DynamoDB.puml
VPCGroup(vpc) {
  Lambda(fn, "Handler", "Node.js 24")
}
DynamoDB(table, "Orders", "table")
fn --> table : PutItem
@enduml
```

Dark sequence, as PNG:

```hermetic-example format=plantuml output=png
@startuml
!$AWS_DARK = true
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/ApplicationIntegration/SimpleNotificationService.puml
LambdaParticipant(fn, "Publisher", "Node.js 24")
SimpleNotificationServiceParticipant(topic, "Alerts", "SNS")
fn -> topic : Publish
topic --> fn : MessageId
@enduml
```
