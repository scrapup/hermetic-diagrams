# hermetic-diagrams

🌐 **English** | [日本語](./README.ja.md) | [Português](./README.pt.md)

> Hermetic, anti-exfiltration MCP for rendering diagrams offline — the diagram source never leaves
> your environment.

Part of the [scrapup](https://github.com/scrapup/scrapup) ecosystem · distributable standalone ·
built on [Kroki](https://kroki.io) · MIT.
**Status: Beta — MVP implemented (local-render notations, SVG + PNG).**

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

An MCP server that renders diagrams — PlantUML, C4, D2, GraphViz, DBML, ERD, Vega/Vega-Lite — to
SVG/PNG, entirely on your machine, with a verifiable no-egress guarantee.

## Security model — contained by construction

Every request crosses three barriers in series:

1. **Semantic (the MCP as Policy Enforcement Point).** Per-notation validation: reject external
   includes (`!includeurl`, remote sprites/themes, D2 `icon: https://`, GraphViz `image=`, Vega
   `data.url`), block `%getenv`, disable XML DTD/external entities (XXE), allowlist diagram types,
   enforce size/time limits, and fail-closed on any source it cannot parse with confidence.
2. **Network — the primary guarantee.** The renderer (a headless Kroki, never exposed, zero
   published ports) runs in a Docker network with `internal: true` — **no default gateway, no route
   out**.
3. **Renderer.** `KROKI_SAFE_MODE=SECURE` refuses file/URL includes as a last line.

The MCP is the **sole client** of the renderer — there is no path to it that is not the MCP. The
delivered SVG is **sanitized** (a real XML parser + element/attribute allowlist) so it makes no
requests when displayed: `script`, `foreignObject`, and remote `href`/`url()` are removed.

### Prove, don't trust

At every boot the gateway proves containment and **fails closed** if it cannot — the render tool is
not even registered unless all gates pass:

- **Egress self-check** — the MCP attempts a SYN-only TCP connect to a fixed public IP; if it
  *connects*, an external route exists and it refuses to operate (`NOT_CONTAINED`).
- **Canary render** — a diagram with a remote include is sent to the engine bypassing the PEP; the
  engine must refuse it. (In CI, the golden test asserts a controlled sink is **never** reached.)
- **Kroki healthcheck** — the gateway serves only after the engine reports ready.
- **Homologated & pinned** — images are pinned by `sha256` (see `images.lock`); a new digest is
  promoted only after re-proving containment.
- **Zero-egress MCP** — no outbound HTTP client, no telemetry; it reaches Kroki over the internal
  network only, via **POST-with-body** (never GET-with-source-in-the-URL).

## Requirements

- **Docker** (Desktop or Engine) running **Linux containers**, with Docker Compose 2.24 or newer.
  On Windows, use Docker Desktop with the WSL 2 backend (Linux containers mode). All heavy runtimes
  live inside pinned Linux images, so the same setup works on Windows, macOS and Linux.
- **Node.js 24 or newer**, for `npx`.

## Install

Two steps, identical on Windows, macOS and Linux: register the server with your AI assistant, then
prepare it once.

### 1. Register the server

Every channel starts the same thing: the npm package `@scrapup/hermetic-diagrams`, pinned to an
exact version and run through `npx`.

**Claude Code plugin** (recommended):

```
/plugin marketplace add scrapup/hermetic-diagrams
/plugin install hermetic-diagrams
```

**GitHub Copilot CLI plugin:**

```
copilot plugin marketplace add scrapup/hermetic-diagrams
copilot plugin install hermetic-diagrams
```

**Any other MCP client** — register the same launcher the plugin uses. It resolves `npx` on every
OS (`npx.cmd` on Windows) and runs the pinned version:

<!-- x-release-please-start-version -->
```json
{
  "mcpServers": {
    "hermetic-diagrams": {
      "command": "node",
      "args": [
        "-e",
        "const w=process.platform==='win32',a=['--prefer-offline','-y','@scrapup/hermetic-diagrams@'+process.argv[1]],p=require('node:child_process'),c=w?p.spawn('npx.cmd '+a.join(' '),{stdio:'inherit',shell:true}):p.spawn('npx',a,{stdio:'inherit'});for(const s of['SIGINT','SIGTERM'])process.on(s,()=>c.kill(s));c.on('exit',x=>process.exit(x??1));c.on('error',()=>process.exit(127))",
        "0.4.1"
      ]
    }
  }
}
```
<!-- x-release-please-end -->

### 2. Prepare it once (per version)

Run this in your own terminal before the first use, and again after each upgrade:

<!-- x-release-please-start-version -->
```
npx @scrapup/hermetic-diagrams@0.4.1 up
```
<!-- x-release-please-end -->

`up` checks the prerequisites (Docker reachable, Linux containers, Compose version), pulls the
pinned Kroki image by digest, builds the MCP image for this version on your machine, starts the
renderer and waits until it is healthy. Progress is printed in the terminal; it exits non-zero
naming the step that failed.

After that, the AI assistant starts the server in seconds: it never downloads or builds anything.
If the version is not prepared, the server stops at once and its log shows the exact `up` command
to run — it never hangs until the assistant times out.

Stop the stack and remove its volumes with the same package and version, replacing `up` with
`down`.

### 3. Upgrade to a new version

Each plugin release pins a new package version, so upgrading takes two steps: update the plugin,
then prepare the new version with `up`.

**Claude Code** — refresh the marketplace catalog, update the plugin, then restart Claude Code:

```
claude plugin marketplace update hermetic-diagrams
claude plugin update hermetic-diagrams@hermetic-diagrams
```

**GitHub Copilot CLI** — refresh the marketplace catalogs, then update the plugin:

```
copilot plugin marketplace update
copilot plugin update hermetic-diagrams
```

Then run `up` for the new version, as in step 2. If you skip it, the server stops at its first
start and its log shows the exact `up` command with the new version. **Any other MCP client:**
change the version in the launcher configuration and run `up` for it.

## Usage — MCP tools

### `render_diagram`

Request:

```json
{ "format": "plantuml", "source": "@startuml\nAlice -> Bob: hi\n@enduml", "output": "svg" }
```

Response (success):

```json
{ "format": "svg", "mimeType": "image/svg+xml", "encoding": "utf8", "data": "<svg …/>" }
```

Response (error):

```json
{ "error": { "code": "EXTERNAL_REFERENCE", "message": "…", "detail": "…" } }
```

Error codes: `INVALID_FORMAT`, `INVALID_SYNTAX`, `EXTERNAL_REFERENCE`, `EMPTY_CONTENT`,
`TOO_LARGE`, `RENDER_TIMEOUT`, `RENDER_ERROR`, `NOT_CONTAINED`.

### `list_formats`

```json
{ "input": ["plantuml","c4","d2","graphviz","dbml","erd","vega","vega-lite"], "output": ["svg","png"] }
```

### `containment_status`

```json
{
  "contained": true,
  "checks": {
    "krokiHealth": "pass", "egressSelfCheck": "pass", "canaryRender": "pass",
    "krokiSafeMode": "SECURE", "publishedPorts": "none"
  }
}
```

## Supported formats

| Input notation | SVG | PNG |
|---|---|---|
| PlantUML | ✅ | ✅ |
| C4 (C4-PlantUML) | ✅ | ✅ |
| GraphViz | ✅ | ✅ |
| ERD | ✅ | ✅ |
| D2 | ✅ | — |
| DBML | ✅ | — |
| Vega | ✅ | — |
| Vega-Lite | ✅ | — |

SVG (the default) is available for every notation. PNG is available for the notations the Kroki
core image can rasterize without browser components; for the rest, request SVG.

## Limitations (MVP)

- **Local-render notations only.** Notations that need browser components (Mermaid, BPMN,
  Excalidraw) are deferred to a later cycle (RN-05).
- **PNG for a subset** (see the table). D2/DBML/Vega/Vega-Lite render to SVG only in this cycle.
- **Online during `up` only** — the package, the pinned images (by digest) and the MCP image's
  production dependencies are fetched once per version, before the internal network exists. The
  running server never uses the network. Air-gapped bundles are a later cycle.
- **stdio transport only.**

## License

MIT © 2026 scrapup. Author: Marco Antonio Luqueti Faustino.
