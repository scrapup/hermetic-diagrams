# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
