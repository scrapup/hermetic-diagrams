# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`hermetic-diagrams` — an anti-exfiltration MCP that renders diagrams (PlantUML, C4, D2, Mermaid,
BPMN…) entirely offline. A Node.js MCP server that manages and fronts a **headless Kroki** running
in a **no-egress Docker network**. Distributable standalone (`@scrapup/hermetic-diagrams`) and
consumed by the scrapup ecosystem. Built on Kroki.

**Status: Beta — MVP implemented** (local-render notations, SVG + PNG). Specs live in
`docs/specs/` (`mvp/`, `plugin-distribution/`, `cross-platform-entrypoint/`): change the spec/plan
before changing behaviour.

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

## Architecture

Two processes, split by where they run:

- **CLI** (`src/cli/`, host) — orchestrates the Docker lifecycle via the `docker` CLI
  (`docker compose -f <pkg>/compose.yaml`); never sees diagram source. `bin.ts` is a thin
  dispatcher; logic lives in `commands.ts` (`up`, `serve`), `preflight.ts`, `docker-runner.ts`,
  `version.ts`.
  - `up` (user-run, once per version): preflight → pull Kroki → build the MCP image → start Kroki
    and wait healthy. All heavy work happens here.
  - `serve` (default; the AI assistant runs it): time-boxed preflight, **never pulls or builds**;
    if the version is not prepared it exits at once with `run: npx @scrapup/hermetic-diagrams@<v> up`.
- **MCP gateway** (`src/index.ts` and the rest of `src/`, inside the `mcp` container) — boot gate
  (Kroki health → egress self-check → canary), PEP, Kroki client, SVG sanitizer, stdio server.

Invariants of the entry point:

- Every channel runs the **pinned npm package through `npx`**, via the `node -e` launcher in
  `.mcp.json` (`npx.cmd` + shell on Windows). **Never** use `${CLAUDE_PLUGIN_ROOT}` or a bare
  `"command": "npx"` in `.mcp.json`; `src/plugin/mcp-config.spec.ts` enforces it.
- The MCP image is tagged `hermetic-diagrams-mcp:${HD_VERSION}`; the CLI exports `HD_VERSION` from
  `package.json`, and `compose.yaml` refuses to run without it.
- The image is built on the user's machine from the published package: the slim `Dockerfile`
  copies the prebuilt `dist/` and runs `npm ci --omit=dev` against `npm-shrinkwrap.json`, which the
  release job generates from `package-lock.json`.
- release-please bumps the version in `package.json`, the plugin manifests, `.mcp.json` and the
  three READMEs.

## Commands

Node 24 (`.nvmrc`); Docker with Linux containers for golden/integration.

| Command | What it does |
|---|---|
| `npm run build` | Compile to `dist/` (required before golden/integration and the image build) |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint (no `any`) |
| `npm test` / `npm run test:coverage` | Unit suite (no Docker) / with the 80% coverage gate |
| `npm run test:golden` | Golden exfiltration test (Docker) |
| `npm run test:integration` | Compose stack, packed-artifact CLI e2e, image build (Docker; files run serially) |
| `npx vitest run --project unit <file>` | Run a single unit test file |
| `node dist/cli/bin.js up` | Prepare the stack from a checkout (after `npm run build`) |

Docs: `README.md` is the English source; `README.pt.md` / `README.ja.md` replicate every change in
the same commit (`src/docs/readme.spec.ts` checks structure and code blocks).

## Naming & language

- Package `@scrapup/hermetic-diagrams`; repo `scrapup/hermetic-diagrams`. **Never put "kroki" in
  the name** (third-party trademark, and it couples the name to a swappable engine) — cite it only
  in prose ("built on Kroki").
- Artifacts (code, docs, commits, identifiers) are in **English**; conversational replies to the
  user are in **PT-BR** (scrapup convention).
