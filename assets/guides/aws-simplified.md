# AWS simplified and experimental styles

Two optional AWS styles shipped with the icon set {{AWS_ICONS_VERSION}}: `AWSSimplified` (icon above the label, no stereotypes, borderless) and `AWSExperimental` (icon notes and numbered callouts). Use the `plantuml` format and the reserved `AWSPuml/` prefix.

## When to use

- `AWSSimplified`: clean architecture overviews and slides, where the icon and a short label
  are enough (the technology argument is not shown).
- `AWSExperimental`: sequence diagrams annotated with small AWS icon notes
  (`$AWSIconLeft` / `$AWSIconRight`), and numbered callouts (`<$Callout_1>` … `<$Callout_99>`)
  in any diagram to reference steps in text.
- The default look (icon, label, technology) is in `aws-architecture`.

## Building blocks

- Include order: `!include AWSPuml/AWSCommon.puml` first, then `!include AWSPuml/AWSSimplified.puml`
  and/or `!include AWSPuml/AWSExperimental.puml`, then the icons.
- With `AWSSimplified`, use the same entity macros as `aws-architecture`:
  `Lambda(fn, "Handler", "")` — the third argument may be empty.
- `AWSSimplified` also restyles `<Icon>Participant` macros in sequence diagrams.
- With `AWSExperimental`:
  - `$AWSIconLeft("<Icon>", "Label")` / `$AWSIconRight("<Icon>", "Label")` attach a half-size
    icon note to the previous message — **sequence diagrams only**; quote the icon name and
    include its file;
  - `<$Callout_N>` places a numbered circle (1–99) inside any label, in any diagram.
- Groups (`aws-architecture`) work with both styles.

## Refused here (and what to use instead)

| Refused | Why | Use instead |
|---|---|---|
| `AWSSimplified.puml` or `AWSExperimental.puml` included before `AWSCommon.puml` | Invalid order (`INVALID_SYNTAX`) | `AWSCommon.puml` first |
| Including the styles by internet address (`raw.githubusercontent.com/…`) or via `!define AWSPuml <address>` | Remote fetch / redefinition | `!include AWSPuml/AWSSimplified.puml` |
| Callout or icon images by address (`<img:` + URL) | Remote fetch | `<$Callout_N>` and `$AWSIconLeft` from `AWSExperimental` |

## Examples

Simplified architecture overview:

```hermetic-example format=plantuml output=svg
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/AWSSimplified.puml
!include AWSPuml/NetworkingContentDelivery/CloudFront.puml
!include AWSPuml/Storage/SimpleStorageService.puml
!include AWSPuml/NetworkingContentDelivery/APIGateway.puml
!include AWSPuml/Compute/Lambda.puml
left to right direction
CloudFront(cdn, "CDN", "")
SimpleStorageService(site, "Static site", "")
APIGateway(api, "API", "")
Lambda(fn, "Handler", "")
cdn --> site
cdn --> api
api --> fn
@enduml
```

Sequence with icon notes and callouts (experimental), as PNG:

```hermetic-example format=plantuml output=png
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/AWSExperimental.puml
!include AWSPuml/Storage/SimpleStorageService.puml
!include AWSPuml/Compute/Lambda.puml
actor User as u
participant "Uploads" as bucket
participant "Resizer" as fn
u -> bucket : <$Callout_1> PutObject
$AWSIconRight("SimpleStorageService", "S3 bucket")
bucket -> fn : <$Callout_2> object created
$AWSIconRight("Lambda", "Node.js 24")
fn -> bucket : <$Callout_3> PutObject (thumbnail)
@enduml
```

Callouts in an activity diagram:

```hermetic-example format=plantuml output=svg
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/AWSExperimental.puml
start
:<$Callout_1> Upload image;
:<$Callout_2> Resize image;
:<$Callout_3> Store thumbnail;
stop
@enduml
```
