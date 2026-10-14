# AWS icons in C4 diagrams

Placeholder guide (icon set {{AWS_ICONS_VERSION}}); full content follows.

## When to use

TBD.

## Building blocks

TBD.

## Refused here (and what to use instead)

TBD.

## Examples

```hermetic-example format=c4 output=svg
@startuml
!include <C4/C4_Container>
!include AWSPuml/AWSC4Integration.puml
!include AWSPuml/AWSCommon.puml
!include AWSPuml/Compute/Lambda.puml
Container(fn, "Handler", "Lambda", $sprite="Lambda")
@enduml
```
