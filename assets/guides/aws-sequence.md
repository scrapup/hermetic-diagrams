# AWS sequence diagrams

Placeholder guide (icon set {{AWS_ICONS_VERSION}}); full content follows.

## When to use

TBD.

## Building blocks

TBD.

## Refused here (and what to use instead)

TBD.

## Examples

```hermetic-example format=plantuml output=svg
@startuml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Compute/Lambda.puml
Lambda(fn, "Handler", "Node.js 24")
@enduml
```
