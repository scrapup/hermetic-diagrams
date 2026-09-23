# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0](https://github.com/scrapup/hermetic-diagrams/compare/v0.2.0...v0.3.0) (2026-09-23)


### Features

* build and force-push the dist branch on release (TF-78-01) ([3a59ef8](https://github.com/scrapup/hermetic-diagrams/commit/3a59ef8f4c81075cef1dd6b6545c0142153be9d2))
* point the marketplace plugin source at the dist branch (TF-78-03) ([9679e2f](https://github.com/scrapup/hermetic-diagrams/commit/9679e2f76562f00903051b0f097cbd7314eabed4))
* reliable plugin installation across AI-assistant marketplaces (US-78) ([#5](https://github.com/scrapup/hermetic-diagrams/issues/5)) ([c5db912](https://github.com/scrapup/hermetic-diagrams/commit/c5db912b62780009c3d8451ac264f07e7b1ab2e1))


### Bug Fixes

* pin release actions by SHA and avoid raw expression interpolation in shell ([3143b10](https://github.com/scrapup/hermetic-diagrams/commit/3143b102dca82d7a12c2b2b29fc5d2dd060111a6))

## [0.2.0](https://github.com/scrapup/hermetic-diagrams/compare/v0.1.0...v0.2.0) (2026-09-23)


### Features

* Claude Code plugin and marketplace manifests + MCP server declaration (TF-77-04) ([3c1d7c2](https://github.com/scrapup/hermetic-diagrams/commit/3c1d7c213c0f144236c5daa77b449aa8056c5727))
* CLI/bin — Docker lifecycle orchestration (up/serve/down/pull) (TF-76-01) ([c11fdea](https://github.com/scrapup/hermetic-diagrams/commit/c11fdeab48868f585f8b5b06f434f5b0d6788d73))
* contained Docker stack — internal network, pinned Kroki core, MCP gateway image (TF-72-02/03) ([68176a1](https://github.com/scrapup/hermetic-diagrams/commit/68176a150d3de48b100366cde0118bb5a17fd20f))
* contained render pipeline, Kroki client, SVG sanitizer, concurrency and MCP tools (US-75) ([40fc4fe](https://github.com/scrapup/hermetic-diagrams/commit/40fc4fee56441b4451b609d5a88d18be83d1f20d))
* MVP hermetic-diagrams — MCP de renderização de diagramas sem exfiltração ([#1](https://github.com/scrapup/hermetic-diagrams/issues/1)) ([0033462](https://github.com/scrapup/hermetic-diagrams/commit/003346238c1f8b7ee6326923bce098919e824210))
* PEP format/syntax validation and per-notation security scanner (US-74) ([1a198b1](https://github.com/scrapup/hermetic-diagrams/commit/1a198b1e841d704e7a22e67433550cd03127b452))
* runtime containment proof — egress self-check, canary, boot gate (US-73) ([e0dcf01](https://github.com/scrapup/hermetic-diagrams/commit/e0dcf0142f8f34a38bb91a3a394ae54e1b395d2e))


### Bug Fixes

* address re-review — timeout races body read, fail-closed on unreachable canary sink, TOO_LARGE symmetry, doc NOT_CONTAINED ([271d3b0](https://github.com/scrapup/hermetic-diagrams/commit/271d3b03d99617addde20f44052acab584b9143f))
* allow Vega/Vega-Lite $schema metadata URL in the security scanner (US-74) ([6ef5a50](https://github.com/scrapup/hermetic-diagrams/commit/6ef5a5069b94e702bba41c17444ea3b93e33ca0d))
* enforce size gate first, cover response-body read with the render timeout, map Kroki 4xx to INVALID_SYNTAX ([a761cd7](https://github.com/scrapup/hermetic-diagrams/commit/a761cd7e0e18b96dcd10474f53c1bb78830a6003))
* make the boot canary non-vacuous via an internal instrumented sink (zero-hit assertion) ([71d7505](https://github.com/scrapup/hermetic-diagrams/commit/71d7505f55320d64d10a0ad15d1169b822bdb4f8))

## [Unreleased]

### Added

- **Contained rendering environment** — Docker Compose stack on an `internal: true` network with a
  headless, digest-pinned Kroki core and a non-root MCP gateway image; no published ports.
- **Runtime containment proof (fail-closed)** — boot gate running an egress self-check, a canary
  render, and a Kroki healthcheck; the render tool is registered only when all pass.
- **Policy Enforcement Point** — per-notation format/syntax/security validation that rejects
  external references (remote includes/imports/icons/images, `data.url`, `%getenv`, XML DTD/XXE)
  and enforces a source-size limit before any render.
- **Contained render + delivery** — internal Kroki client (POST-with-body, timeout, output cap),
  SVG output sanitizer (XML parser + allowlist), concurrency guard, and the `render_diagram`,
  `list_formats`, `containment_status` MCP tools over stdio.
- **Distribution & assurance** — `hermetic-diagrams` bin (Docker lifecycle), golden exfiltration
  suite, docker-compose integration tests, and CI (validation matrix + containment + homologation).
- **Docs & packaging** — README, CONTRIBUTING, npm publish config, Claude Code plugin/marketplace
  files, and a self-update script.

[Unreleased]: https://github.com/scrapup/hermetic-diagrams/commits/main
