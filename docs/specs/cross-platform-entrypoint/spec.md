# Functional Specification: Cross-platform entry point and one-time preparation

> SDD Phase 1 — business intent (What / Why), technology-agnostic. The How (architecture,
> components, contracts) lives in `plan.md` (Phase 2).

## 1. Overview and Objective

- **The Problem:** the service does not start reliably for a user on a fresh machine, and the
  failure is silent. Three observed causes:
  1. **Heavy work on first connection.** The first time an AI assistant connects, the service
     downloads, prepares and boots its whole rendering environment before answering. That work
     outlasts the assistant's startup wait, and the assistant drops the connection with a generic
     "connection closed" — observed on Windows; the same path exists on every OS for a first run.
  2. **Different entry points per channel.** Each install channel (AI-assistant marketplace,
     global package install) launches the service differently. One of them relies on a location
     variable that only exists in one context, so opening the project's own repository in an AI
     assistant registers a second, broken copy of the service.
  3. **Incomplete package.** The package published to the public registry lacks what is needed to
     prepare the service locally, so preparation cannot succeed from that channel at all.
- **The Solution (What):**
  - A **single entry point** — the versioned package on the public registry — used identically by
    every install channel and every supported operating system (Windows, macOS, Linux).
  - A **one-time preparation step** the user runs explicitly (the existing `up` command, improved)
    that leaves everything ready: rendering environment downloaded, service prepared, environment
    running and healthy.
  - A **fast start** afterwards: when the AI assistant connects, the service only attaches to what
    is already prepared, and fails immediately with an actionable message when preparation is
    missing.
  - **Trilingual public documentation** (English, Portuguese, Japanese), following the scrapup
    organization convention.
- **The Value (Why):** a working first use on every supported OS and channel, with failures that
  explain themselves instead of timing out silently. Removes the adoption blocker observed on
  Windows and aligns the project's public surface with the rest of the scrapup organization. The
  containment guarantee — diagram source never leaves the machine — is unchanged.

## 2. User Journeys

Actors:
- **User** — installs the service and uses it through a compatible AI assistant, on Windows,
  macOS or Linux.
- **AI assistant** — the client (Claude Code, GitHub Copilot CLI, or any compatible one) that
  starts the service and talks to it.
- **Maintainer** — publishes new versions through the existing release process.
- **System** — the service and its local rendering environment.

**Main Journey — first use on a fresh machine:**
1. The User installs the service through any supported channel.
2. The User runs, once, in their own terminal, the preparation command for the installed version
   (`up`). Progress is visible in that terminal.
3. The System downloads the pinned rendering environment, prepares the service for that exact
   version, starts the environment and waits until it reports healthy.
4. The System ends the preparation with an explicit success or failure result.
5. The User opens the AI assistant; it starts the service and connects within its startup wait.
6. Result: the diagram tools are available on first connection.

**Alternative Journey A — the AI assistant connects before preparation:**
1. The User skips step 2 and opens the AI assistant.
2. The System detects that the installed version has not been prepared.
3. The System does **not** attempt the heavy work; it stops immediately and reports, through the
   assistant's diagnostic output, the exact preparation command to run for that version.
4. The User runs the command and reconnects; the Main Journey resumes at step 5.

**Alternative Journey B — upgrading to a new version:**
1. The Maintainer publishes a new version through the existing release process; the version
   referenced by every install channel is updated by that same process.
2. The User updates the installation.
3. The System treats the new version as not prepared (Alternative Journey A) until the User runs
   the preparation for it; it never runs the new version on top of what was prepared for an older
   one.

**Alternative Journey C — reading the documentation:**
1. A visitor opens the project's public documentation.
2. The visitor switches between English, Portuguese and Japanese through a language navigation
   line at the top; all three carry the same content, including the preparation step.

## 3. Business Rules and Constraints

| # | Rule | Type |
|---|---|---|
| RN-01 | Every install channel and every supported OS launches the service through the same single entry point: the versioned package on the public registry. No channel executes a copy bundled inside its own install location. | Mandatory |
| RN-02 | The entry point is always pinned to an exact version. Floating references ("latest") are never used by an install channel. | Restrictive |
| RN-03 | Preparation is an explicit, one-time user action through the existing `up` command. No new command is introduced for it. | Mandatory |
| RN-04 | `up` completes all heavy work — download, local preparation of the service, environment start — and returns only once the environment is healthy, or fails with an explicit result. | Mandatory |
| RN-05 | Starting the service from an AI assistant never performs downloads or local preparation. If the installed version is not prepared, it fails immediately with a message that names the exact command to run. | Restrictive |
| RN-06 | What is prepared is bound to the version that prepared it. A version never runs on top of what another version prepared. | Restrictive |
| RN-07 | The published package contains everything `up` needs to prepare the service locally; preparation from any channel does not depend on a source checkout. | Mandatory |
| RN-08 | The same install configuration works unchanged on Windows, macOS and Linux. | Mandatory |
| RN-09 | The release process updates the pinned version referenced by every install channel as part of each release, with no manual step. | Mandatory |
| RN-10 | Containment is unchanged: the rendering environment stays isolated with no route out, publishes no port, uses only pinned images, and the service keeps no outbound client. Network access happens only during `up`, to fetch pinned artifacts, and never carries diagram source. | Restrictive |
| RN-11 | Diagnostic and progress output never goes through the channel the AI assistant uses to talk to the service. | Restrictive |
| RN-12 | Public documentation exists in English (source of truth), Portuguese and Japanese, with a language navigation line at the top of each; Portuguese and Japanese replicate every English change in the same commit. | Mandatory |

## 4. Edge Cases and Exception Flows (Zero Trust)

| Scenario | Expected Behavior | Severity |
|---|---|---|
| AI assistant starts the service before `up` ran for that version | Fail immediately (no download, no preparation), report the exact `up` command for that version | Critical |
| The container runtime is not installed or not running | `up` and service start both fail immediately with a message naming the missing prerequisite | High |
| The container runtime runs in a mode that cannot execute the rendering environment (e.g. Windows containers mode) | `up` fails with a message naming the required mode | High |
| No network during `up` | `up` fails with an explicit result; nothing half-prepared is treated as ready | High |
| Rendering environment does not become healthy within the preparation wait | `up` fails with an explicit result and leaves no state that the service start would treat as ready | High |
| User upgrades the installation but does not re-run `up` | Treated as "not prepared" for the new version (RN-05/RN-06) | High |
| `up` is run again on an already prepared version | Completes successfully without redoing finished work beyond what is needed to confirm health | Low |
| The project's own repository is opened in an AI assistant | No broken duplicate registration of the service appears | Medium |
| A floating or mismatched version is referenced by an install channel | Must be detectable before release and blocked from being published | High |
| Containment topology does not match at service start | Unchanged: the service refuses to operate (existing boot gate) | Critical |

## 5. Success Criteria and SLAs

**Functional Criteria:**
- [ ] On fresh Windows, macOS and Linux machines: install → `up` → open the AI assistant → the
      diagram tools are available and the containment status reports contained.
- [ ] Opening the AI assistant before `up` produces an immediate, actionable failure — never a
      timeout.
- [ ] All install channels reference the same pinned entry point, updated by the release process.
- [ ] No broken duplicate service appears when the project repository is opened in an AI assistant.
- [ ] Public documentation available in English, Portuguese and Japanese with identical content.
- [ ] Containment proof (golden exfiltration test) still passes.

**SLAs:**
- Service start after `up`, until the AI assistant sees the tools: no fixed bound — as long as the
  user's machine needs to start the prepared service; the start path does no download or preparation
  work (RN-05), so its duration is the machine's own boot cost.
- Failure when not prepared (or when a prerequisite is missing): reported within **240 s** of the
  AI assistant starting the service.
- `up` duration on first run: not bounded (depends on the user's network); progress must be
  visible throughout.

**Quality Criteria:**
- [ ] Unit tests cover command parsing, version binding, and the prepared / not-prepared start paths.
- [ ] Integration test prepares and starts the service from the packed, published-shape artifact
      in a clean location (Linux CI).
- [ ] Manual verification on Windows and macOS recorded before declaring done.

## 6. Glossary

| Term | Definition in this context |
|---|---|
| Entry point | The single way every install channel launches the service: the versioned package on the public registry. |
| Install channel | A way to install the service: an AI-assistant marketplace plugin (Claude Code, Copilot CLI) or manual registration after a global package install. |
| Preparation (`up`) | The one-time, user-run step that downloads, prepares and starts the rendering environment for one exact version. |
| Prepared version | A version for which `up` completed successfully on this machine. |
| Service start | What the AI assistant triggers when it connects; attaches to a prepared version only. |
| Rendering environment | The isolated, no-egress local environment that renders diagrams. |
| Containment | The guarantee that diagram source never leaves the machine. |
