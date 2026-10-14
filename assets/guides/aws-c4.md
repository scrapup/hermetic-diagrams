# AWS icons in C4 diagrams

C4 container and component views whose elements carry the shipped AWS service icons (icon set {{AWS_ICONS_VERSION}}). Use the `c4` format: the bundled C4 library plus `AWSPuml/AWSC4Integration.puml`.

## When to use

- C4 container/component views of a system that runs on AWS, where each container should show
  its AWS service.
- Plain C4 without AWS branding: use `c4`. Network placement (VPCs, subnets): `aws-architecture`.

## Building blocks

- Include order:
  1. one bundled C4 level: `!include <C4/C4_Container>` (or `<C4/C4_Component>`, `<C4/C4_Context>`);
  2. `!include AWSPuml/AWSC4Integration.puml`;
  3. `!include AWSPuml/AWSCommon.puml`;
  4. one include per icon, e.g. `!include AWSPuml/Compute/Lambda.puml` (names from `list_aws_icons`).
- Put an icon on any C4 element with `$sprite="<Icon>"`, the icon's file name:
  `Container(fn, "Handler", "AWS Lambda", "Validates orders", $sprite="Lambda")`,
  `ContainerDb(table, "Orders", "Amazon DynamoDB", "Order items", $sprite="DynamoDB")`.
- Everything else is regular C4: `Person`, `System_Ext`, `System_Boundary(…) { … }`,
  `Container_Boundary`, `Rel(from, to, "Label", "Technology")`, `SHOW_LEGEND()`.
- `LAYOUT_WITH_LEGEND()` (from `AWSC4Integration`) adds a legend that includes the AWS colour.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| C4-PlantUML or AWS icons by internet address (`raw.githubusercontent.com/…`) | Remote fetch | `!include <C4/…>` (bundled) and `!include AWSPuml/<path>` (shipped) |
| `!define AWSPuml <address>` | Redefines the reserved prefix | Nothing: `AWSPuml/` works without a definition |
| Icon includes before `AWSCommon.puml` | Invalid order (`INVALID_SYNTAX`) | The include order above |
| `$sprite` pointing at an image address (`img:` + URL) | Remote fetch | `$sprite="<Icon>"` after including the icon |
| Unknown or misspelled icon paths | Not in the shipped set (`UNKNOWN_REFERENCE`) | Exact paths from `list_aws_icons` |

## Examples

Container view with AWS icons:

```hermetic-example format=c4 output=svg
@startuml
!include <C4/C4_Container>
!include AWSPuml/AWSC4Integration.puml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/NetworkingContentDelivery/APIGateway.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/Database/DynamoDB.puml
title Orders - container view
Person(customer, "Customer", "Places orders")
System_Boundary(orders, "Orders") {
  Container(api, "Orders API", "Amazon API Gateway", "REST endpoint", $sprite="APIGateway")
  Container(fn, "Handler", "AWS Lambda", "Validates and stores orders", $sprite="Lambda")
  ContainerDb(table, "Orders", "Amazon DynamoDB", "Order items", $sprite="DynamoDB")
}
Rel(customer, api, "Places orders", "HTTPS")
Rel(api, fn, "Invokes")
Rel(fn, table, "Reads/writes")
SHOW_LEGEND()
@enduml
```

Asynchronous processing, as PNG:

```hermetic-example format=c4 output=png
@startuml
!include <C4/C4_Container>
!include AWSPuml/AWSC4Integration.puml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/ApplicationIntegration/SimpleQueueService.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/Storage/SimpleStorageService.puml
System_Ext(producer, "Order service", "Publishes order events")
ContainerQueue(queue, "Order events", "Amazon SQS", $sprite="SimpleQueueService")
Container(worker, "Invoice worker", "AWS Lambda", "Builds invoices", $sprite="Lambda")
ContainerDb(bucket, "Invoices", "Amazon S3", "PDF invoices", $sprite="SimpleStorageService")
Rel(producer, queue, "Sends")
Rel(worker, queue, "Polls")
Rel(worker, bucket, "Writes")
@enduml
```
