# AWS sequence diagrams

Request flows between AWS services in PlantUML sequence diagrams, with the shipped AWS icons as participants (icon set {{AWS_ICONS_VERSION}}). Use the `plantuml` format and the reserved `AWSPuml/` prefix.

## When to use

- Request/response or event flows across AWS services, in time order.
- Retry, error and asynchronous paths (`alt`, `opt`, `loop`, `par`) between services.
- For static placement in accounts/VPCs use `aws-architecture`.

## Building blocks

- **Always first:** `!include AWSPuml/AWSCommon.puml`, then one include per icon used, e.g.
  `!include AWSPuml/Compute/Lambda.puml` (names from `list_aws_icons`).
- **Participant macros:** `<Icon>Participant(alias, "Label", "Technology")`, e.g.
  `LambdaParticipant(fn, "Handler", "Node.js 24")`; with a description add a fourth argument.
- Mix with plain participants: `actor`, `participant`, `database`, `queue`.
- Messages: `a -> b : text`, replies `b --> a : text`, async `a ->> b`.
- Grouping: `alt` / `else` / `end`, `opt`, `loop`, `par` / `else`, `group Label`.
- Activation: `activate fn` / `deactivate fn`, or the shorthand `a -> b ++` / `b --> a --`.
- Separators and notes: `== Checkout ==`, `note over fn : text`.
- `autonumber` numbers the messages.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| Upstream's documented form: `!include` of `raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/<tag>/dist/…` | Remote fetch | `!include AWSPuml/<path>` |
| `!define AWSPuml <address>` | Redefines the reserved prefix | Nothing: `AWSPuml/` works without a definition |
| Icon includes before `AWSCommon.puml` | Invalid order (`INVALID_SYNTAX`) | `!include AWSPuml/AWSCommon.puml` first |
| Unknown or misspelled icon paths | Not in the shipped set (`UNKNOWN_REFERENCE`) | Exact paths from `list_aws_icons` |

## Examples

API request with a conditional path:

```hermetic-example format=plantuml output=svg
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/NetworkingContentDelivery/APIGateway.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/Database/DynamoDB.puml
autonumber
actor Customer as user
APIGatewayParticipant(api, "Orders API", "REST")
LambdaParticipant(fn, "Handler", "Node.js 24")
DynamoDBParticipant(table, "Orders", "table")
user -> api : POST /orders
api -> fn ++ : invoke
fn -> table : PutItem
alt condition check failed
  table --> fn : ConditionalCheckFailed
  fn --> api : 409
else stored
  table --> fn : ok
  fn --> api -- : 201
end
api --> user : response
@enduml
```

Event-driven flow, as PNG:

```hermetic-example format=plantuml output=png
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Storage/SimpleStorageService.puml
!include AWSPuml/ApplicationIntegration/EventBridge.puml
!include AWSPuml/ApplicationIntegration/SimpleQueueService.puml
!include AWSPuml/Compute/Lambda.puml
SimpleStorageServiceParticipant(bucket, "Uploads", "S3")
EventBridgeParticipant(bus, "Default bus", "EventBridge")
SimpleQueueServiceParticipant(queue, "Thumbnails", "SQS")
LambdaParticipant(worker, "Resizer", "Node.js 24")
bucket ->> bus : Object Created
bus ->> queue : rule match
loop until the queue is empty
  worker -> queue : ReceiveMessage
  queue --> worker : batch
  worker -> bucket : PutObject (thumbnail)
end
@enduml
```
