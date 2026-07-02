# hermetic-diagrams

> Hermetic, anti-exfiltration MCP for rendering diagrams offline — the diagram source never leaves
> your environment.

Part of the [scrapup](https://github.com/scrapup/scrapup) ecosystem · distributable standalone ·
built on [Kroki](https://kroki.io) · MIT.
**Status: early — architecture defined, implementation in progress.**

## Why

Ask any LLM — or engineer — to "render this diagram to a PNG" and the obvious path is to **delegate
to a public server** (`kroki.io`, `plantuml.com`): it is the majority pattern in every tutorial,
requires installing nothing, and is the only way a model without a harness can produce an image at
all. That default **leaks**: the source — service names, topology, sometimes secrets in labels — is
sent to a third party, and the common `GET`-with-source-in-the-URL variant lands the whole diagram
in proxy caches, access logs and history.

Neither human nor AI picks the sealed path on their own; both take the low-friction one. So the
guarantee here is **structural, not behavioural**: exfiltration is made impossible by construction,
not discouraged by policy.

## What it does

An MCP server that renders diagrams — PlantUML, C4, D2, Mermaid, BPMN, and more — to SVG/PNG,
entirely on your machine, with a verifiable no-egress guarantee.

## Security model — contained by construction

Every request crosses three barriers in series:

1. **Semantic (the MCP as Policy Enforcement Point).** Per-format validation: reject external
   includes (`!includeurl`, remote sprites/themes, `icon: https://`), disable XML DTD/external
   entities (BPMN → XXE), allowlist diagram types, enforce size/time limits, fail-closed on any
   source it cannot parse with confidence.
2. **Network — the primary guarantee.** The renderer (a headless Kroki, never exposed, zero
   published ports) and its companions run in a Docker network with `internal: true` — **no default
   gateway, no route out**. Even the headless-Chromium companions (Mermaid/BPMN) cannot reach the
   internet.
3. **Renderer.** `KROKI_SAFE_MODE=SECURE` refuses file/URL includes as a last line.

The MCP is the **sole client** of the renderer — there is no path to it that is not the MCP.

### Prove, don't trust

- **Fail-closed on boot** — the MCP verifies, via the Docker API, that the networks are
  `internal: true` and no unexpected port is published; if the topology does not match, it refuses
  to operate.
- **Golden exfiltration test** — a diagram with a remote include pointed at a controlled sink
  passes only if the request never arrives.
- **Homologated & pinned** — images are pinned by `sha256`; a new version is promoted only after
  re-proving containment.
- **Zero-egress MCP** — no outbound HTTP client, no telemetry.

## Supported formats (planned)

PlantUML · C4 · D2 · GraphViz · DBML · ERD · Vega/Vega-Lite · Mermaid · BPMN · Excalidraw — the
Kroki set, minus any renderer that cannot run without external network access.

## Requirements

Docker. All heavy runtimes (the PlantUML JVM, the Mermaid/BPMN Chromium) live inside pinned Linux
images, so the host needs nothing else — the same setup works on Windows, macOS and Linux.

## Status

Early. The architecture and threat model are defined; the MCP, the sealed Docker topology, and the
verification harness are under construction. Interfaces will change.

## License

MIT © 2026 scrapup.
