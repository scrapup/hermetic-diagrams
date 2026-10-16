# Execution Backlog: hermetic-diagrams (MVP)

> SDD Phase 3. Prerequisites: approved `spec.md` and `plan.md`.
> Stack: Node.js + strict TypeScript, MCP SDK (stdio), Docker Compose, Kroki core image.
> Personal project — no Sami stack (no NestJS/sami-broker/sami-logger/DB/RabbitMQ).

## Reference Epic

**Epic:** E-00 — hermetic-diagrams (personal initiative; no PM). Macro context: `spec.md` + `plan.md`.

---

## Traceability

| Requirement (spec.md) | Decision (plan.md) | User Story | Tasks |
|---|---|---|---|
| RN-01, RN-06 | `internal: true` network; headless Kroki; MCP sole client | US-72 | TF-72-02, TF-72-03 |
| RN-02, RN-05 | Kroki core (local-render); allowlist | US-72, US-74 | TF-72-03, TF-74-01 |
| RN-04 | Fail-closed via egress self-check + canary render | US-73 | TF-73-01, TF-73-02, TF-73-03 |
| RN-08 | Digest pinning + homologation | US-72, US-76, US-77 | TF-72-03, TF-76-03, TF-77-03 |
| RN-03, RN-07, RN-09 | PEP: per-notation validation, DTD/getenv off, limits | US-74 | TF-74-01, TF-74-02, TF-74-03 |
| RN-10, RN-11 | SVG/PNG output; parser-based sanitization | US-75 | TF-75-01, TF-75-02, TF-75-04 |
| Verifiable containment (criterion) | Golden exfiltration test; cross-platform CI | US-76 | TF-76-02, TF-76-03 |
| CI validation & integration tests | PR gates + local docker-compose e2e | US-76 | TF-76-04, TF-76-05 |
| Usability & distribution | README/CONTRIBUTING, npm publish, Claude marketplace, self-update | US-77 | TF-77-01…TF-77-05 |

Reference diagrams (reused across US): [`plan.md` §2](plan.md) — C4 N2/N3 and sequence (success+failure).

---

## User Stories Overview

| # | User Story | Value Delivered | Depends on |
|---|---|---|---|
| US-72 | Contained rendering environment | The stack comes up sealed: internal Kroki responds, zero published ports | — |
| US-73 | Runtime-proven containment (fail-closed) | The gateway refuses to operate if containment is not proven, at every boot | US-72 |
| US-74 | Input validation and containment (PEP) | Invalid/dangerous input rejected before any render | US-72 |
| US-75 | Contained rendering and delivery | Requester gets sanitized SVG/PNG from a valid diagram | US-73, US-74 |
| US-76 | Distribution and continuous assurance | Installable via npm, usable in Claude Code, with CI proving containment | US-75 |
| US-77 | Documentation, packaging & publishing | Users know how to use/contribute; package publishes to npm and the Claude marketplace; self-update | US-76 |

---

## US-72: Contained rendering environment

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 5 SP · **Priority:** P0

### Value Narrative
> **As an** operator, **I want** to bring the rendering service up already isolated from the external
> network, **so that** no render can leak data by construction.

### Business Context
Foundation of the product: the contained environment (no-egress network + headless Kroki) and the MCP
scaffold. Nothing else runs without this US. Materializes RN-01/RN-06 in the topology.

### Acceptance Criteria
- [ ] `docker compose up -d` brings Kroki and MCP up on the `internal: true` network, with no published port.
- [ ] Kroki answers a trivial render **only** over internal DNS (`kroki:8000`).
- [ ] Images are referenced by `@sha256:` (never by mutable tag).

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-01 | No data leaves the environment | Restrictive |
| RN-06 | Engine never directly reachable; MCP is the sole client | Restrictive |
| RN-08 | Images pinned by digest | Mandatory |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-72-01 | Project scaffold | Foundation | — |
| TF-72-02 | MCP Gateway image | Build | TF-72-01 |
| TF-72-03 | Compose: internal network + Kroki + MCP | Infra | TF-72-02 |

### Tasks

#### TF-72-01: [hermetic-diagrams] TypeScript + MCP SDK project scaffold
**User Story:** US-72 · **Priority:** P0

##### 1. Description & Objective
> **As a** developer, **I want** a strict-TS skeleton with the MCP SDK and test tooling, **so that**
> the remaining tasks share a consistent base.

##### 2. Technical Specification
**2.1 Interception points (create):**
- `package.json` — name `@scrapup/hermetic-diagrams`, bin, scripts (build/test/lint), module type.
- `tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess`, modern target.
- `src/index.ts` — MCP server entrypoint (stub).
- `src/server/` — structure for transport/tools.
- Lint (ESLint) and test (Vitest or Jest) config + `.editorconfig`.

**2.4 Zero Trust:** `any` forbidden; `strict` on; no runtime network dependencies.

##### 4. Execution Guidance
**4.2 Steps:** 1) init package + strict tsconfig; 2) install MCP SDK; 3) set up lint+test;
4) create a stub entrypoint that registers the MCP server (no tools yet).
**4.3 Validation:** `npm run build && npm run lint && npm test`
**4.6 Exit criteria:** build/lint/test pass; entrypoint starts and exits cleanly.

##### 5. Definition of Done
- [ ] `tsconfig` in strict mode, `any` forbidden in lint.
- [ ] `npm run build`, `lint`, and `test` pass a smoke test.
- [ ] MCP entrypoint starts over stdio without errors.

---

#### TF-72-02: [hermetic-diagrams] MCP Gateway Dockerfile
**User Story:** US-72 · **Priority:** P0

##### 1. Description & Objective
> **As an** operator, **I want** to package the gateway into a minimal Linux image, **so that** it
> runs as a container on the internal network, without depending on the host.

##### 2. Technical Specification
**2.1 Interception points (create):**
- `Dockerfile` — multi-stage build (deps → TS build → slim runtime); non-root user.
- `.dockerignore`.

**2.4 Zero Trust:** base image pinned by digest; no Docker socket; no network tools beyond what is needed.

##### 4. Execution Guidance
**4.2 Steps:** 1) build stage (tsc); 2) slim runtime with artifact + production deps only;
3) non-root `USER`; 4) `CMD` starts the MCP over stdio.
**4.3 Validation:** `docker build -t hermetic-diagrams-mcp:dev .` and a local run that starts/exits.
**4.6 Exit criteria:** image builds; container starts the MCP over stdio.

##### 5. Definition of Done
- [ ] Reproducible build; non-root runtime.
- [ ] Base image pinned by digest.
- [ ] Container starts the MCP server without error.

---

#### TF-72-03: [hermetic-diagrams] Compose — internal network, Kroki core, and MCP
**User Story:** US-72 · **Priority:** P0

##### 1. Description & Objective
> **As an** operator, **I want** to declare the contained stack in Compose, **so that** containment
> is a property of the topology (no-egress network).

##### 2. Technical Specification
**2.1 Interception points (create):**
- `compose.yaml` — `internal: true` network; `kroki` service (core image `yuzutech/kroki@sha256:…`,
  `KROKI_SAFE_MODE=SECURE`, minimal env, `healthcheck`, `deploy.resources`/`--memory`/`--pids-limit`,
  `PLANTUML_LIMIT_SIZE`); `mcp` service (image from TF-72-02, on the internal network, **no** ports,
  **no** Docker socket, `depends_on: kroki healthy`).
- `images.lock` — homologated digests of `kroki` and `mcp`.

**2.4 Zero Trust:** no published port; `internal: true` mandatory; Kroki env without secrets
(neutralizes `%getenv`); limited resources (local-DoS defense).

##### 4. Execution Guidance
**4.2 Steps:** 1) internal network; 2) kroki service with SAFE_MODE, healthcheck, limits, minimal env,
digest; 3) mcp service on the network without ports/socket; 4) `images.lock`.
**4.3 Validation:** `docker compose up -d`; `docker compose ps` (no ports); internal render via
`docker compose exec mcp` calling `kroki:8000`; `docker network inspect` confirms `internal`.
**4.6 Exit criteria:** stack comes up; zero ports; Kroki responds internal-only; network is internal.

##### 5. Definition of Done
- [ ] `internal: true` verified; no published port.
- [ ] Kroki with SAFE_MODE=SECURE, healthcheck, resource limits, and minimal env.
- [ ] Images by digest in `images.lock`.

---

## US-73: Runtime-proven containment (fail-closed)

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 5 SP · **Priority:** P0

### Value Narrative
> **As a** validator, **I want** the gateway to prove containment at every boot and refuse to operate
> if it fails, **so that** the guarantee is verified, not assumed.

### Business Context
Implements "prove, don't trust" (plan §5.4). Without this US, containment would be just configuration.

### Acceptance Criteria
- [ ] With an external route present (misconfigured environment), the gateway refuses to serve (`NOT_CONTAINED`).
- [ ] The canary render confirms a remote include does not leave; if it does, fail-closed.
- [ ] `containment_status` reports the gate results.

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-04 | Fail-closed if containment is not proven | Conditional |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-73-01 | Egress self-check | Containment | TF-72-03 |
| TF-73-02 | Canary render | Containment | TF-72-03 |
| TF-73-03 | Boot gate + containment_status tool | Orchestration | TF-73-01, TF-73-02 |

### Tasks

#### TF-73-01: [hermetic-diagrams] Egress self-check (fail-closed)
**User Story:** US-73 · **Priority:** P0

##### 1. Description & Objective
> **As a** validator, **I want** to prove the gateway has no external route, **so that** network
> containment is empirical.

##### 2. Technical Specification
**2.1 Create:** `src/containment/egress-check.ts`.
**2.4 Zero Trust:** TCP connect to a fixed public IP with a short timeout; **connecting = containment
failure**; never send data (SYN only); result `pass` only if the connection fails.

##### 4. Execution Guidance
**4.2 Steps:** 1) attempt connect to a fixed IP; 2) short timeout; 3) map connect-ok → `NOT_CONTAINED`.
**4.3 Validation:** `npm test -- egress-check` (socket mock: connect success ⇒ fail-closed).
**4.6 Exit criteria:** returns `fail` when egress exists; `pass` when blocked.

##### 5. Definition of Done
- [ ] `pass` only when egress is impossible.
- [ ] No payload byte is sent.
- [ ] Test covers both paths (contained / with egress).

---

#### TF-73-02: [hermetic-diagrams] Canary render (bypasses the PEP)
**User Story:** US-73 · **Priority:** P0

##### 1. Description & Objective
> **As a** validator, **I want** to prove the *engine* does not fetch external resources, **so that**
> Kroki's containment is verified, not just the MCP's.

##### 2. Technical Specification
**2.1 Create:** `src/containment/canary-render.ts`.
**2.4 Zero Trust:** sends Kroki — **deliberately bypassing the PEP** — a diagram with a remote
reference to a controlled sink; the render must fail/ignore without the sink being reached. Reaching
the sink ⇒ `NOT_CONTAINED`.

##### 4. Execution Guidance
**4.2 Steps:** 1) build a source with a remote include to the sink; 2) POST directly to `kroki:8000`;
3) verify (via an instrumented sink in the test) that no request arrived.
**4.3 Validation:** `npm test -- canary-render` (sink mock; assert zero hits).
**4.6 Exit criteria:** canary `pass` only if the sink is not reached.

##### 5. Definition of Done
- [ ] Sink is never reached on the happy path (contained).
- [ ] Reaching the sink ⇒ fail-closed.
- [ ] Reusable as a golden test (US-76).

---

#### TF-73-03: [hermetic-diagrams] Boot gate + `containment_status` tool
**User Story:** US-73 · **Priority:** P0

##### 1. Description & Objective
> **As a** validator, **I want** to orchestrate the gates at boot and expose them, **so that** the
> gateway only serves when contained and the state is inspectable.

##### 2. Technical Specification
**2.1 Create:** `src/containment/boot-gate.ts`, `src/server/tools/containment-status.ts`.
**2.3 Contract:** `containment_status` output per `plan.md` §4.3.
**2.4 Zero Trust:** order — Kroki healthcheck → egress self-check → canary; any failure ⇒ the server
**does not register the render tools** (fail-closed).

##### 4. Execution Guidance
**4.2 Steps:** 1) run the 3 gates at startup; 2) block registration of `render_diagram` on failure;
3) expose `containment_status`.
**4.3 Validation:** `npm test -- boot-gate` (failed gate ⇒ render unavailable; all green ⇒ available).
**4.6 Exit criteria:** render only available with the 3 gates green.

##### 5. Definition of Done
- [ ] Boot fail-closed when any gate fails.
- [ ] `containment_status` reports each check.
- [ ] Render tools not registered without containment.

---

## US-74: Input validation and containment (PEP)

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 8 SP · **Priority:** P0

### Value Narrative
> **As a** requester, **I want** invalid or dangerous inputs rejected before rendering, **so that**
> errors are clear and no external reference is resolved.

### Business Context
The Policy Enforcement Point (plan §5.2). Materializes RN-03/RN-09 and per-notation validation.

### Acceptance Criteria
- [ ] Unknown/out-of-scope format ⇒ clear error, no render.
- [ ] Invalid syntax ⇒ descriptive error (reason/location), no render.
- [ ] Per-notation external reference (e.g., Vega `data.url`, `!includeurl`) ⇒ refusal; nothing leaves.

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-03 | Block external references before resolving | Restrictive |
| RN-05 | Local-render scope | Restrictive |
| RN-09 | Validate format + syntax before rendering | Mandatory |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-74-01 | Format validator (allowlist) | Validation | TF-72-01 |
| TF-74-02 | Per-notation syntax validator | Validation | TF-74-01 |
| TF-74-03 | Per-notation security scanner | Security | TF-74-01 |

### Tasks

#### TF-74-01: [hermetic-diagrams] Format validator (allowlist)
**User Story:** US-74 · **Priority:** P0

##### 2. Technical Specification
**2.1 Create:** `src/pep/format-validator.ts`.
**2.3 Contract:** input `{ format, output }`; errors `INVALID_FORMAT` / (out of MVP).
**2.4 Zero Trust:** input allowlist (plantuml,c4,d2,graphviz,dbml,erd,vega,vega-lite) and output
allowlist (svg,png); default `output=svg`; anything else ⇒ rejection.

##### 4. Execution Guidance
**4.3 Validation:** `npm test -- format-validator`.
**4.6 Exit criteria:** accepts only the allowlist; clear messages for unknown and out-of-MVP.

##### 5. Definition of Done
- [ ] Input and output allowlists enforced.
- [ ] Unknown vs out-of-MVP distinguished by error.
- [ ] Coverage of valid/invalid cases.

---

#### TF-74-02: [hermetic-diagrams] Per-notation syntax validator
**User Story:** US-74 · **Priority:** P1

##### 2. Technical Specification
**2.1 Create:** `src/pep/syntax-validator.ts`.
**2.4 Zero Trust:** empty/whitespace-only ⇒ `EMPTY_CONTENT`; invalid encoding ⇒ error; invalid
syntax ⇒ `INVALID_SYNTAX` with detail (location where the notation allows). Fail-closed if it cannot
interpret safely.

##### 4. Execution Guidance
**4.2 Steps:** lightweight per-notation validation (without running the engine); map descriptive errors.
**4.3 Validation:** `npm test -- syntax-validator`.
**4.6 Exit criteria:** rejects empty/invalid with a useful message; accepts valid.

##### 5. Definition of Done
- [ ] Empty, invalid encoding, and invalid syntax covered.
- [ ] Error carries reason (and location when possible).
- [ ] No rendering is triggered during validation.

---

#### TF-74-03: [hermetic-diagrams] Per-notation security scanner (external refs, DTD, getenv)
**User Story:** US-74 · **Priority:** P0

##### 1. Description & Objective
> **As the** PEP, **I want** to block every reference to the outside before rendering, **so that** no
> external request is emitted (barrier 1).

##### 2. Technical Specification
**2.1 Create:** `src/pep/security-scanner.ts` (+ per-notation rules).
**2.4 Zero Trust (per-notation vectors — plan §5.2):**
- PlantUML/C4: remote `!include*`, sprites `<img:url>`, `!theme … from url`, `%getenv`.
- D2: remote `@import`/`imports`, `icon: https://`.
- GraphViz: `image=`, `imagepath`, URLs.
- Vega/Vega-Lite: `data.url`, images by URL.
- XML (where applicable): disable DTD/external entities (XXE).
- Source size limit. Any match ⇒ `EXTERNAL_REFERENCE` (or `TOO_LARGE`), no render.

**3. Visual Model:** see the sequence in [`plan.md` §2.3](plan.md) ("external reference" branch).

##### 4. Execution Guidance
**4.3 Validation:** `npm test -- security-scanner` (one case per vector **and** per notation).
**4.4 Constraints:** do NOT use fragile regex where a lightweight per-notation parser is viable.
**4.6 Exit criteria:** all table vectors blocked; a false negative is a critical bug.

##### 5. Definition of Done
- [ ] One test per vector per notation (table §5.2).
- [ ] `%getenv` and DTD/entities blocked.
- [ ] Size limit enforced.

---

## US-75: Contained rendering and delivery

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 8 SP · **Priority:** P1

### Value Narrative
> **As a** requester, **I want** to submit a valid diagram and get a sanitized SVG/PNG, **so that** I
> have the image with no exfiltration vector — neither at render nor at output.

### Business Context
The full happy path: PEP → Kroki client → sanitization → tool. Materializes RN-10/RN-11.

### Acceptance Criteria
- [ ] A valid diagram in each notation renders to SVG (default) and PNG.
- [ ] The delivered SVG contains no `script`/`foreignObject`/external refs.
- [ ] Concurrent requests and heavy diagrams respect the limits (no local DoS).

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-02 | Local render | Mandatory |
| RN-10 | SVG (default) + PNG output | Mandatory |
| RN-11 | Output SVG sanitization | Restrictive |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-75-01 | Kroki client (POST body) | Render | TF-72-03 |
| TF-75-02 | Output sanitizer (SVG) | Output security | TF-75-01 |
| TF-75-03 | Concurrency guard + limits | Resilience | TF-75-01 |
| TF-75-04 | render_diagram/list_formats tools + stdio wiring | Orchestration | TF-74-03, TF-75-02, TF-75-03, TF-73-03 |

### Tasks

#### TF-75-01: [hermetic-diagrams] Kroki client (POST body, timeout, output limit)
**User Story:** US-75 · **Priority:** P1

##### 2. Technical Specification
**2.1 Create:** `src/render/kroki-client.ts`.
**2.3 Contract:** `POST http://kroki:8000/{type}/{output}` body=source (`text/plain`).
**2.4 Zero Trust:** **always POST with a body, never GET with source in the URL**; render timeout;
response size limit; client restricted to the internal host (`kroki`), no external outbound.

##### 4. Execution Guidance
**4.3 Validation:** `npm test -- kroki-client` (integration with real Kroki; timeout; limit).
**4.6 Exit criteria:** render OK returns bytes; timeout/error mapped; never uses GET.

##### 5. Definition of Done
- [ ] POST body; never GET with source.
- [ ] Timeout and output limit enforced.
- [ ] No call to any host other than internal `kroki`.

---

#### TF-75-02: [hermetic-diagrams] Output sanitizer (SVG via parser + allowlist)
**User Story:** US-75 · **Priority:** P0

##### 2. Technical Specification
**2.1 Create:** `src/render/svg-sanitizer.ts`.
**2.4 Zero Trust:** real XML parser + an **allowlist** of elements/attributes; remove `script`,
`foreignObject`, remote `href`/`xlink:href`/`url()`, `on*` handlers; **fail-closed** if it cannot
sanitize with confidence. PNG needs no sanitization (raster).

##### 4. Execution Guidance
**4.4 Constraints:** do NOT sanitize with regex; use a parser.
**4.3 Validation:** `npm test -- svg-sanitizer` (malicious SVGs: script, foreignObject, remote href).
**4.6 Exit criteria:** output free of out-of-allowlist elements/attributes.

##### 5. Definition of Done
- [ ] `script`/`foreignObject`/external refs/`on*` removed.
- [ ] Fail-closed when the parse is not trustworthy.
- [ ] Coverage of dangerous-SVG vectors.

---

#### TF-75-03: [hermetic-diagrams] Concurrency guard + anti-DoS limits
**User Story:** US-75 · **Priority:** P1

##### 2. Technical Specification
**2.1 Create:** `src/render/concurrency.ts`.
**2.4 Zero Trust:** max-concurrency semaphore; overflow queues or rejects with a clear error;
respects the per-render timeout (TF-75-01) and the output size limit.

##### 4. Execution Guidance
**4.3 Validation:** `npm test -- concurrency` (overflow queues/rejects; no queue leak).
**4.6 Exit criteria:** load beyond the limit does not bring the service down.

##### 5. Definition of Done
- [ ] Concurrency limit enforced.
- [ ] Overflow handled (queue/rejection) without crash.
- [ ] Basic load test passes.

---

#### TF-75-04: [hermetic-diagrams] `render_diagram`/`list_formats` tools + stdio wiring
**User Story:** US-75 · **Priority:** P1

##### 1. Description & Objective
> **As a** requester, **I want** the MCP tools that orchestrate PEP → render → sanitization, **so
> that** I can render a diagram end-to-end from the MCP client.

##### 2. Technical Specification
**2.1 Create:** `src/server/tools/render-diagram.ts`, `src/server/tools/list-formats.ts`,
`src/server/error-mapper.ts`, wiring in `src/index.ts`.
**2.3 Contract:** `render_diagram`/`list_formats` per `plan.md` §4.1–4.2; errors per the §4 codes.
**2.4 Zero Trust:** pipeline: format → syntax → security → (guard) → kroki client → svg sanitizer.
Only registered if the boot gates (TF-73-03) are green.

**3. Visual Model:** success+failure sequence in [`plan.md` §2.3](plan.md).

##### 4. Execution Guidance
**4.3 Validation:** `npm test -- render-diagram` (e2e over stdio: valid notation ⇒ sanitized image;
invalid ⇒ mapped error).
**4.5 Skills:** `test-driven-agentic-development` (core logic; verify impact/tests).
**4.6 Exit criteria:** happy and error e2e pass; correct error codes.

##### 5. Definition of Done
- [ ] Happy path returns sanitized SVG (default) and PNG.
- [ ] Each error class returns the correct code.
- [ ] Tools unavailable without proven containment.

---

## US-76: Distribution and continuous assurance

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 5 SP · **Priority:** P1

### Value Narrative
> **As an** operator, **I want** to install via npm and have CI that proves containment, **so that**
> the product is usable in Claude Code and the guarantee is continuous.

### Business Context
Closes the MVP: packaging (bin/CLI + lifecycle) and the safety net (golden test + CI + homologation).

### Acceptance Criteria
- [ ] `npx` (or bin) brings the stack up, connects the client over stdio, and tears down with cleanup.
- [ ] The golden exfiltration test runs per notation and fails if any sink is reached.
- [ ] CI green on Windows, macOS, and Linux; a digest bump requires re-proving containment.
- [ ] Every PR runs typecheck, lint, build, and unit tests (with a coverage threshold) as blocking gates.
- [ ] Integration tests bring up the local docker-compose stack, render each notation e2e, assert containment, and tear down.

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-08 | Homologation by digest | Mandatory |
| RN-01 | Containment (verified in CI) | Restrictive |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-76-01 | bin/CLI + lifecycle | Distribution | TF-72-03, TF-75-04 |
| TF-76-02 | Golden exfiltration test suite | Quality | TF-73-02, TF-74-03 |
| TF-76-04 | CI validation stages (typecheck/lint/build/unit+coverage) | Quality | TF-72-01 |
| TF-76-05 | Integration tests via local docker-compose | Quality | TF-72-03, TF-75-04 |
| TF-76-03 | Cross-platform CI matrix + digest homologation | Quality | TF-76-01, TF-76-02, TF-76-04, TF-76-05 |

### Tasks

#### TF-76-01: [hermetic-diagrams] bin/CLI + lifecycle (up -d / run -T / down)
**User Story:** US-76 · **Priority:** P1

##### 2. Technical Specification
**2.1 Create:** `src/cli/bin.ts` (registered as `bin` in package.json).
**2.4 Zero Trust:** the bin only orchestrates Docker (compose up -d for Kroki, run -T for the MCP with
stdio attached, down for cleanup) and does the first-run pull (by digest); it does **not** process the
source nor do any network beyond invoking Docker. Cross-platform (Docker Desktop/WSL2 on Windows; named pipe).

##### 4. Execution Guidance
**4.3 Validation:** test on Linux (and manual macOS/Windows via TF-76-03 CI): the `bin` brings the
stack up, renders over stdio, and tears down.
**4.6 Exit criteria:** up→render→down cycle works; first run reports pull progress.

##### 5. Definition of Done
- [ ] up -d / run -T / down lifecycle working.
- [ ] First-run pull by digest with feedback.
- [ ] No network logic beyond invoking Docker.

---

#### TF-76-02: [hermetic-diagrams] Golden exfiltration test suite
**User Story:** US-76 · **Priority:** P0

##### 2. Technical Specification
**2.1 Create:** `test/golden/exfiltration.spec.ts` + per-notation fixtures.
**2.4 Zero Trust:** for each notation, a source with an external reference to an **instrumented sink**;
the test passes **only if** the sink is never reached (reuses the canary mechanism — TF-73-02).

##### 4. Execution Guidance
**4.3 Validation:** `npm run test:golden`.
**4.6 Exit criteria:** the suite covers all notations; a sink hit = failure.

##### 5. Definition of Done
- [ ] One fixture per notation with an external reference.
- [ ] Instrumented sink with a zero-hits assertion.
- [ ] Integrated into the CI gate (TF-76-03).

---

#### TF-76-04: [hermetic-diagrams] CI validation stages (typecheck/lint/build/unit + coverage)
**User Story:** US-76 · **Priority:** P1

##### 2. Technical Specification
**2.1 Create/update:** validation job in `.github/workflows/ci.yml`; `package.json` scripts
(`typecheck`, `lint`, `build`, `test`, `test:coverage`); coverage config with a threshold.
**2.2 Content:** ordered per-PR gates — install (lockfile) → `tsc --noEmit` → ESLint (zero errors,
`no-explicit-any`) → build → unit + coverage threshold. Any red stage blocks merge.
**2.4 Zero Trust:** these stages need no network (unit is hermetic; sockets mocked).

##### 4. Execution Guidance
**4.3 Validation:** open a PR; confirm all stages run and a failing type/lint/test/coverage blocks merge.
**4.6 Exit criteria:** validation stages green on a clean branch; red on an injected failure.

##### 5. Definition of Done
- [ ] typecheck, lint, build, unit+coverage as blocking PR gates.
- [ ] Coverage threshold enforced.
- [ ] Deterministic install (lockfile).

---

#### TF-76-05: [hermetic-diagrams] Integration tests via local docker-compose
**User Story:** US-76 · **Priority:** P1

##### 1. Description & Objective
> **As a** validator, **I want** integration tests that bring up the real stack via docker-compose,
> **so that** the end-to-end path and containment are verified against the real Kroki.

##### 2. Technical Specification
**2.1 Create:** `test/integration/` suite + a compose helper (up / healthcheck-wait / down).
**2.2 Content:** `docker compose up -d` on the `internal: true` network; for each notation, render to
SVG and PNG through the MCP over stdio against the **real Kroki**; assert the sanitized output; assert
containment (`docker compose ps` = no published port; `docker network inspect` = internal; egress
self-check + canary pass); reject an external-reference source. Always `docker compose down -v` in
teardown, even on failure.
**2.4 Zero Trust:** the suite must not depend on any external network; the stack under test has no egress.

##### 4. Execution Guidance
**4.3 Validation:** `npm run test:integration` locally (requires Docker); stack comes up, e2e passes, tears down.
**4.5 Skills:** `test-driven-agentic-development`.
**4.6 Exit criteria:** e2e green against the compose stack; deterministic teardown.

##### 5. Definition of Done
- [ ] Each notation rendered e2e to SVG and PNG against real Kroki.
- [ ] Containment assertions (no ports, internal network, egress/canary) pass.
- [ ] Teardown always runs (`down -v`), even on failure.

---

#### TF-76-03: [hermetic-diagrams] Cross-platform CI matrix + digest homologation
**User Story:** US-76 · **Priority:** P1

##### 2. Technical Specification
**2.1 Create:** CI workflow (`.github/workflows/ci.yml`), homologation doc in `docs/specs/mvp/` or
`CONTRIBUTING`.
**2.4 Zero Trust:** the Windows/macOS/Linux matrix runs build+lint+unit+integration+golden. A digest
bump in `images.lock` requires re-running golden + a render smoke of all notations before promotion;
a mutable tag is forbidden.

##### 4. Execution Guidance
**4.3 Validation:** green pipeline on all 3 OSes; a dedicated job that fails if `images.lock` changes
without re-proving containment.
**4.6 Exit criteria:** cross-platform CI green; homologation gate active.

##### 5. Definition of Done
- [ ] Win/Mac/Linux matrix green.
- [ ] Golden test as a mandatory gate.
- [ ] Digest homologation process documented and enforced in CI.

---

## US-77: Documentation, packaging & publishing

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 5 SP · **Priority:** P1

### Value Narrative
> **As a** user/contributor, **I want** clear usage and contribution docs, and the package published
> to npm and the Claude marketplace with a self-update path, **so that** I can adopt, extend, and keep
> the tool current.

### Business Context
Turns the working MVP into a distributable, adoptable product: usage/contribution docs, the npm
release process, the Claude Code plugin (MCP) marketplace files, and a self-update script.

### Acceptance Criteria
- [ ] `README.md` documents install and usage (formats, tools, containment guarantee).
- [ ] `CONTRIBUTING.md` documents dev setup, tests, and the homologation process.
- [ ] The package publishes to npm reproducibly (versioned, provenance).
- [ ] The plugin installs from a Claude marketplace and exposes the MCP server.
- [ ] `update.sh` refreshes the locally installed plugin from source.

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-08 | Versions pinned/homologated | Mandatory |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-77-01 | Usage docs (README) | Docs | TF-76-01 |
| TF-77-02 | CONTRIBUTING guide | Docs | TF-76-03 |
| TF-77-03 | npm publish process | Packaging | TF-76-03 |
| TF-77-04 | Claude marketplace files (plugin + MCP) | Packaging | TF-76-01 |
| TF-77-05 | update.sh (self-update) | Packaging | TF-77-04 |

### Tasks

#### TF-77-01: [hermetic-diagrams] Usage documentation in README.md
**User Story:** US-77 · **Priority:** P1

##### 1. Description & Objective
> **As a** user, **I want** a README that shows how to install and use the tool, **so that** I can
> render diagrams with the containment guarantee without reading the source.

##### 2. Technical Specification
**2.1 Interception points (update):** `README.md`.
**2.2 Content:** install (npm and/or Claude marketplace), prerequisites (Docker), the MCP tools
(`render_diagram`, `list_formats`, `containment_status`) with request/response examples, supported
notations and output formats, the containment guarantee (three barriers, in short), first-run note
(image pull), and limitations (local-render MVP).

##### 4. Execution Guidance
**4.2 Steps:** expand the existing README with an Install and a Usage section + tool examples.
**4.3 Validation:** manual review; examples match the tool contracts in `plan.md` §4.
**4.6 Exit criteria:** a new user can install and render following only the README.

##### 5. Definition of Done
- [ ] Install + usage + tool examples present and accurate.
- [ ] Containment guarantee and limitations stated.
- [ ] English (source of truth).

---

#### TF-77-02: [hermetic-diagrams] CONTRIBUTING guide
**User Story:** US-77 · **Priority:** P2

##### 2. Technical Specification
**2.1 Create:** `CONTRIBUTING.md`.
**2.2 Content:** dev setup (Node, Docker), how to build/lint/test and run a single test, how to run
the golden exfiltration test, the SDD flow (link to `docs/specs/mvp/`), the digest homologation
process (TF-76-03), commit/PR conventions, and the security invariants that must never regress
(from the repo `CLAUDE.md`).

##### 4. Execution Guidance
**4.3 Validation:** manual review; commands match `package.json` scripts.
**4.6 Exit criteria:** a contributor can set up, test, and open a PR following only this guide.

##### 5. Definition of Done
- [ ] Dev setup, test commands, and single-test recipe documented.
- [ ] Homologation process and security invariants stated.
- [ ] Contribution conventions defined.

---

#### TF-77-03: [hermetic-diagrams] npm publish process
**User Story:** US-77 · **Priority:** P1

##### 2. Technical Specification
**2.1 Interception points (create/update):** `package.json` (`files`, `bin`, `publishConfig` with
`access: public`, `engines`), `.npmignore` (or `files` allowlist), release workflow
(`.github/workflows/release.yml`).
**2.2 Content:** semver policy; publish on a git tag; `npm publish --provenance` from CI (OIDC), not
from a laptop; ensure only the built artifact + `compose.yaml` + `images.lock` + docs ship (no
source-only/test files); `prepublishOnly` runs build+lint+test+golden.
**2.4 Zero Trust:** publish only from CI on a tag; never publish with a failing golden test; scoped
package `@scrapup/hermetic-diagrams` with public access.

##### 4. Execution Guidance
**4.3 Validation:** `npm pack` dry-run inspects the tarball contents; a release dry-run on a tag.
**4.6 Exit criteria:** tagging a release publishes a correct, minimal tarball with provenance.

##### 5. Definition of Done
- [ ] `package.json` publish config + `files`/`.npmignore` correct (verified via `npm pack`).
- [ ] Release workflow publishes on tag with `--provenance`.
- [ ] `prepublishOnly` gates on build+lint+test+golden.

---

#### TF-77-04: [hermetic-diagrams] Claude marketplace files (plugin + MCP)
**User Story:** US-77 · **Priority:** P1

##### 1. Description & Objective
> **As a** user, **I want** to install this as a Claude Code plugin from a marketplace, **so that**
> the MCP server is available in Claude Code with one command.

##### 2. Technical Specification
**2.1 Create:**
- `.claude-plugin/plugin.json` — `name` (kebab-case), `version` (semver, kept in sync with
  `package.json`), `description`, `author`, `homepage`, `repository`, `license`, `keywords`.
- `.mcp.json` — `mcpServers.hermetic-diagrams` with `command` pointing to the bin via
  `${CLAUDE_PLUGIN_ROOT}` (the bin orchestrates the compose + stdio proxy — TF-76-01); no absolute
  paths.
- `.claude-plugin/marketplace.json` — `name`, `owner`, `plugins[]` entry (`name`, `source`,
  `description`, `version`, `repository`, `license`, `keywords`).
- `CHANGELOG.md`.
**2.4 Zero Trust:** use `${CLAUDE_PLUGIN_ROOT}` (never absolute paths); plugin version pinned and
kept in sync with the npm version.

##### 4. Execution Guidance
**4.2 Steps:** 1) plugin.json; 2) .mcp.json pointing to the bin; 3) marketplace.json; 4) CHANGELOG.
**4.3 Validation:** `claude plugin validate .`; local install via a local marketplace and a smoke
render through the MCP.
**4.6 Exit criteria:** `claude plugin validate` passes; local install exposes the render tools.

##### 5. Definition of Done
- [ ] `plugin.json`, `.mcp.json`, `marketplace.json`, `CHANGELOG.md` present and valid.
- [ ] MCP server declared via `${CLAUDE_PLUGIN_ROOT}` (no absolute paths).
- [ ] `claude plugin validate` clean; local install renders.

---

#### TF-77-05: [hermetic-diagrams] update.sh (self-update from source)
**User Story:** US-77 · **Priority:** P2

##### 1. Description & Objective
> **As an** operator, **I want** a script that refreshes the locally installed plugin from source,
> **so that** local edits propagate to the Claude Code cache (mirrors the scrapforge `update.sh`).

##### 2. Technical Specification
**2.1 Create:** `update.sh` (executable).
**2.2 Content (pattern from `~/.claude/plugins/local/scrapforge/update.sh`):** `set -euo pipefail`;
require the `claude` CLI; read `version` from `.claude-plugin/plugin.json`; `claude plugin uninstall
<plugin>@<marketplace> -y || true`; `claude plugin install <plugin>@<marketplace>`; print a reminder
to run `/reload-plugins`.
**2.4 Zero Trust:** fail if the `claude` CLI is absent; do not swallow install errors (only the
uninstall may be ignored).

##### 4. Execution Guidance
**4.3 Validation:** run `./update.sh` against a local marketplace install; confirm the cache snapshot
refreshes.
**4.6 Exit criteria:** running the script reinstalls the plugin from source and prints the reload hint.

##### 5. Definition of Done
- [ ] Reads version from `plugin.json`; reinstalls via the `claude` CLI.
- [ ] Fails clearly without the `claude` CLI.
- [ ] Prints the `/reload-plugins` reminder.

---

## Execution note

Complex TFs (e.g., TF-74-03, TF-75-04) may be decomposed into iterations via `mimic-loop`
(task template §4.7) during execution, with state in `mcp-saga`. The rest are direct. Recommended
implementation order: US-72 → US-73/US-74 (parallelizable after the infra) → US-75 → US-76 → US-77.
