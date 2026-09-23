# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`hermetic-diagrams` — an anti-exfiltration MCP that renders diagrams (PlantUML, C4, D2, Mermaid,
BPMN…) entirely offline. A Node.js MCP server that manages and fronts a **headless Kroki** running
in a **no-egress Docker network**. Distributable standalone (`@scrapup/hermetic-diagrams`) and
consumed by the scrapup ecosystem. Built on Kroki.

**Status: early — no application code or build tooling exists yet** (only `LICENSE`, `.gitignore`,
`README.md`). The architecture and threat model below are decided; the implementation is not.

## The non-negotiable invariant: containment

The entire product value is that **diagram source cannot leave the machine**. Every change must
preserve this. Concretely:

- The renderer (Kroki + companions) runs in a Docker network with `internal: true` — no default
  gateway, no route out. This is the **primary** guarantee. Never add a bridge/host network to it,
  and never publish the renderer's port.
- Kroki is **headless — never exposed**. The MCP is its **sole client**. There must be no path to
  the renderer that is not the MCP (a low-level `raw` passthrough is fine, but still validated).
- The MCP is a **Policy Enforcement Point (PEP)**: validate source per format, reject external
  includes (`!includeurl`, remote sprites/themes, D2 `icon: https://`), disable XML DTD/external
  entities for BPMN (XXE), allowlist diagram types, enforce size/time limits, and **fail-closed**
  on any source it cannot parse with confidence. Per-format validation — a single regex is not
  enough.
- Set `KROKI_SAFE_MODE=SECURE` on the renderer.
- The MCP itself has **no outbound HTTP client and no telemetry**. Reach Kroki over the internal
  network only, via **POST-with-body — never GET-with-source-in-the-URL** (which leaks source into
  logs/caches).
- **Never** render via a public server (`kroki.io`, `plantuml.com`), not even as a fallback.

Rule of thumb: **the network is the guarantee; the PEP is defense-in-depth.** Do not weaken one by
trusting the other.

## Prove, don't trust

- **Fail-closed on boot**: verify via the Docker API that the networks are `internal: true` and no
  unexpected port is published; refuse to operate if the topology does not match.
- **Golden exfiltration test**: a diagram carrying a remote include aimed at a controlled sink must
  pass only if the request never arrives. Keep this in CI/boot smoke.
- **Pin images by `sha256`** (never mutable tags); promote a new version only after re-proving
  containment.

## Planned stack (not yet scaffolded)

- Node.js MCP server over **stdio** transport.
- Docker lifecycle via **`dockerode`** (covers the Unix socket and the Windows named pipe).
- **Kroki full** via Docker Compose (gateway + companions) on an `internal: true` network.
- Cross-platform (Windows/macOS/Linux): the heavy runtimes (PlantUML JVM, Mermaid/BPMN Chromium)
  live inside **pinned Linux images**, so the host only needs Docker.

No `package.json`, build, test, or lint tooling exists yet. When the scaffold lands, document the
build/test/run commands here (including how to run a single test).

## Naming & language

- Package `@scrapup/hermetic-diagrams`; repo `scrapup/hermetic-diagrams`. **Never put "kroki" in
  the name** (third-party trademark, and it couples the name to a swappable engine) — cite it only
  in prose ("built on Kroki").
- Artifacts (code, docs, commits, identifiers) are in **English**; conversational replies to the
  user are in **PT-BR** (scrapup convention).
