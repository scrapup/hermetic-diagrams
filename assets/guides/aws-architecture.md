# AWS architecture diagrams

AWS architecture diagrams in PlantUML with the official AWS icons shipped in this server (icon set {{AWS_ICONS_VERSION}}): services as icons, nested in account, region, VPC, Availability Zone and subnet groups. Use the `plantuml` format and the reserved `AWSPuml/` prefix.

## When to use

- Deployment/architecture views of an AWS workload: which services exist and how they connect.
- Network placement: what runs in which account, region, VPC, Availability Zone and subnet.
- For request flows over time use `aws-sequence`; for C4 views use `aws-c4`; for a lighter,
  icon-above-label look use `aws-simplified`; for dark backgrounds use `aws-dark`.

## Building blocks

- **Always first:** `!include AWSPuml/AWSCommon.puml`. Every icon, group, `AWSSimplified` and
  `AWSExperimental` include must come after it.
- **One include per icon:** `!include AWSPuml/<Category>/<Icon>.puml`, for example
  `!include AWSPuml/Compute/Lambda.puml`. Find exact names with `list_aws_icons`
  (filter by `category` and/or `query`); it returns the include line and macros for each icon.
- **Entity macros:** `<Icon>(alias, "Label", "Technology")` or with a description,
  `<Icon>(alias, "Label", "Technology", "Description")`, e.g. `Lambda(fn, "Handler", "Node.js 24")`.
- **Connections:** plain PlantUML arrows between aliases: `fn --> bucket : writes`.
- **Groups** (include `AWSPuml/Groups/<Group>.puml`, then nest with braces):
  - `AWSCloudGroup(alias)`, `AWSAccountGroup(alias, "Account")`
  - `RegionGroup(alias, "us-east-1")`, `AvailabilityZoneGroup(alias, "us-east-1a")`
  - `VPCGroup(alias)`, `PublicSubnetGroup(alias, "Public subnet")`,
    `PrivateSubnetGroup(alias, "Private subnet")`
  - `AutoScalingGroupGroup(alias)`, `SecurityGroupGroup(alias)`, `GenericGroup(alias, "Label")`
  - The group include file drops the `Group` suffix: `VPCGroup` lives in `AWSPuml/Groups/VPC.puml`,
    `AutoScalingGroupGroup` in `AWSPuml/Groups/AutoScalingGroup.puml`.
- **Icons inside other elements:** every icon also defines `$<Icon>IMG()`, an inline image, e.g.
  `rectangle "$LambdaIMG()\nHandler" as fn`.
- **Whole category:** `!include AWSPuml/<Category>/all.puml` loads every icon of that category at
  once. It is convenient but large (Storage alone is about 450 KB once expanded); prefer the
  individual includes you need.
- Layout helpers: `left to right direction`, `top to bottom direction`, hidden links
  `a -[hidden]-> b`.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| Upstream's documented form: `!include` of `raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/<tag>/dist/…` | Remote fetch | `!include AWSPuml/<path>` — resolved from the shipped set |
| `!define AWSPuml <address>` (or `!$AWSPuml = …`) | Redefines the reserved prefix | Nothing: `AWSPuml/` already works without a definition |
| An icon, group, `AWSSimplified` or `AWSExperimental` include before `AWSCommon.puml` | Invalid order (`INVALID_SYNTAX`) | Put `!include AWSPuml/AWSCommon.puml` first |
| Unknown or misspelled icon paths, `..`, deeper paths, `!includesub` / `!include_many` on `AWSPuml/` | Not in the shipped set (`UNKNOWN_REFERENCE`) | Exact paths from `list_aws_icons` |
| Icons by address (`<img:` + URL) | Remote fetch | `$<Icon>IMG()` or the entity macros |

The engine's bundled stdlib `<awslib/…>` also works, but it is an older icon set tied to the
engine version; prefer `AWSPuml/` so diagrams match `list_aws_icons`.

## Examples

Serverless workload in nested groups:

```hermetic-example format=plantuml output=svg
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Groups/AWSCloud.puml
!include AWSPuml/Groups/Region.puml
!include AWSPuml/Groups/VPC.puml
!include AWSPuml/Groups/AvailabilityZone.puml
!include AWSPuml/Groups/PublicSubnet.puml
!include AWSPuml/Groups/PrivateSubnet.puml
!include AWSPuml/NetworkingContentDelivery/APIGateway.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/Database/DynamoDB.puml
!include AWSPuml/Storage/SimpleStorageService.puml

AWSCloudGroup(cloud) {
  RegionGroup(region, "us-east-1") {
    APIGateway(api, "Orders API", "REST")
    VPCGroup(vpc) {
      AvailabilityZoneGroup(az1, "us-east-1a") {
        PublicSubnetGroup(pub, "Public subnet") {
        }
        PrivateSubnetGroup(priv, "Private subnet") {
          Lambda(fn, "Handler", "Node.js 24")
        }
      }
    }
    DynamoDB(table, "Orders", "table")
    SimpleStorageService(bucket, "Receipts", "S3")
  }
}

api --> fn : invoke
fn --> table : PutItem
fn --> bucket : PutObject
@enduml
```

Auto Scaling group behind a load balancer, as PNG:

```hermetic-example format=plantuml output=png
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Groups/VPC.puml
!include AWSPuml/Groups/AutoScalingGroup.puml
!include AWSPuml/Groups/SecurityGroup.puml
!include AWSPuml/NetworkingContentDelivery/ElasticLoadBalancingApplicationLoadBalancer.puml
!include AWSPuml/Compute/EC2Instance.puml
!include AWSPuml/Database/RDS.puml
left to right direction

VPCGroup(vpc) {
  ElasticLoadBalancingApplicationLoadBalancer(alb, "ALB", "HTTPS")
  AutoScalingGroupGroup(asg) {
    EC2Instance(web1, "web-1", "t4g.small")
    EC2Instance(web2, "web-2", "t4g.small")
  }
  SecurityGroupGroup(dbsg) {
    RDS(db, "Orders DB", "PostgreSQL")
  }
}

alb --> web1
alb --> web2
web1 --> db
web2 --> db
@enduml
```

Icon images inside plain PlantUML elements:

```hermetic-example format=plantuml output=svg
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Compute/Lambda.puml
!include AWSPuml/ApplicationIntegration/SimpleQueueService.puml
rectangle "$SimpleQueueServiceIMG()\nOrders queue" as queue
rectangle "$LambdaIMG()\nWorker" as worker
queue --> worker : poll
@enduml
```
