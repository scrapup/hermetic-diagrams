# hermetic-diagrams

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

**Docker** (Desktop or Engine; Docker Desktop/WSL2 on Windows). All heavy runtimes live inside a
pinned Linux image, so the host needs nothing else — the same setup works on Windows, macOS and
Linux. Node.js is only needed if you install via npm.

## Install

### As a Claude Code plugin (recommended)

```
/plugin marketplace add scrapup/hermetic-diagrams
/plugin install hermetic-diagrams
```

This registers the MCP server (`.mcp.json`) pointing at the packaged bin
(`${CLAUDE_PLUGIN_ROOT}/dist/cli/bin.js`). When installing from source (git), build the plugin
first so `dist/` exists: `npm ci && npm run build` in the plugin directory (the npm package ships
`dist/` prebuilt).

### As an npm package

```
npm install -g @scrapup/hermetic-diagrams
```

Then register it with your MCP client, e.g. Claude Code:

```json
{
  "mcpServers": {
    "hermetic-diagrams": { "command": "hermetic-diagrams" }
  }
}
```

**First run** pulls the pinned images by digest (progress is printed to stderr); subsequent runs
reuse the already-running Kroki. Bring the stack down with `hermetic-diagrams down`.

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
- **Online pull on first run** — images are fetched (by digest) once, before the internal network
  exists. Air-gapped bundles are a later cycle.
- **stdio transport only.**

## License

MIT © 2026 scrapup. Author: Marco Antonio Luqueti Faustino.
