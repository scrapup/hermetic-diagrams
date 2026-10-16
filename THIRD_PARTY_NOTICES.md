# Third-party notices

`@scrapup/hermetic-diagrams` redistributes the third-party content below. Its own code is MIT
licensed (see `LICENSE`).

## AWS Icons for PlantUML

| Field | Value |
|---|---|
| Upstream | [`awslabs/aws-icons-for-plantuml`](https://github.com/awslabs/aws-icons-for-plantuml) |
| Release tag | `v23.1` |
| Commit | `b788ba79e8cd028be274761f0fadd8bf3b711acd` |
| Location in this package | `assets/aws-icons/v23.1/` (pinned by `aws-icons.lock.json`) |
| Icons license | [Creative Commons Attribution-NoDerivs 2.0 (CC-BY-ND 2.0)](https://creativecommons.org/licenses/by-nd/2.0/) — `assets/aws-icons/v23.1/LICENSE` |
| Code license | MIT — `assets/aws-icons/v23.1/LICENSE-CODE` |

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

The files are **redistributed unmodified**: each one is byte-identical to the upstream release and
its sha256 is recorded in `aws-icons.lock.json` and verified at every start of the MCP gateway. The
upstream per-category `all.puml` files are not redistributed; when a diagram includes
`AWSPuml/<Category>/all.puml`, the gateway synthesizes it by **aggregating** the category's
unmodified files in memory — an aggregation, not a modification of any file.

At render time the gateway also appends, after `AWSCommon.puml` and `AWSExperimental.puml`, a short
compatibility override of two helper functions so that group and note icons render at their
original size (the bundled engine cannot scale embedded images). The override is added to the
diagram being rendered; the shipped files themselves are never changed.
