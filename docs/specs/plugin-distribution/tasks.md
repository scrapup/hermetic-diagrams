# Execution Backlog: Distribuição confiável do plugin via marketplaces (hermetic-diagrams)

> SDD Phase 3. Prerequisites: approved `spec.md` and `plan.md`.
> Personal project — no Sami stack (no NestJS/sami-broker/sami-logger/DB/RabbitMQ). Scope is
> release/distribution infrastructure, not business domain.

## Reference Epic

**Epic:** E-00 — hermetic-diagrams (personal initiative; no PM). Macro context: `spec.md` +
`plan.md` in this same folder.

---

## Traceability

| Requirement (spec.md) | Decision (plan.md) | User Story | Tasks |
|---|---|---|---|
| RN-01, RN-02, RN-03, RN-04 | Orphan `dist` branch, force-pushed by the release job only after `npm publish` succeeds | US-78 | TF-78-01 |
| RN-06, RN-07 | Single `marketplace.json` (in `main`) with a per-plugin structured `source.ref` | US-78 | TF-78-03 |
| RN-06 (Copilot CLI parity) | Explicit `mcpServers` in `plugin.json` | US-78 | TF-78-03 |
| Zero Trust on the untested `${CLAUDE_PLUGIN_ROOT}` risk (plan.md §5.1) | Empirical smoke test on both channels before declaring done | US-78 | TF-78-04 |
| Documentation as acceptance criterion (plan.md §7) | README updated with both install processes | US-78 | TF-78-05 |

Reference diagrams (reused from `plan.md` §2): [`plan.md`](plan.md) — C4 N2 and the release/distribution sequence (success + failure).

---

## User Stories Overview

| # | User Story | Value Delivered | Depends on |
|---|---|---|---|
| US-78 | Reliable plugin installation across AI-assistant marketplaces | Installing via `/plugin marketplace add` (Claude Code) or `copilot plugin marketplace add` (Copilot CLI) works on first use, with no manual build step, always reflecting the last successfully published release | — |

---

## US-78: Reliable plugin installation across AI-assistant marketplaces

**Epic:** E-00 · **System:** scrapup/hermetic-diagrams · **Estimate:** 5 SP · **Priority:** P1

### Value Narrative
> **As a** user installing this plugin through Claude Code or GitHub Copilot CLI, **I want** the
> installation to work on the first try, with no manual build step, **so that** the marketplace
> channel the project itself recommends is actually usable.

### Business Context
Today, `dist/` is `.gitignore`d and installing via any marketplace clones the source without
building it — the MCP server the `.mcp.json`/`mcp.json` points at does not exist, so it never
starts. This closes that gap for both currently-supported AI assistants at once, without adding
any manual step to the release process or to the user-facing install command.

### Acceptance Criteria
- [ ] After a release publishes successfully, `/plugin marketplace add scrapup/hermetic-diagrams`
      → `/plugin install hermetic-diagrams` in Claude Code results in a working MCP server with no
      manual build step.
- [ ] The same holds for `copilot plugin marketplace add scrapup/hermetic-diagrams` in GitHub
      Copilot CLI.
- [ ] A release that fails before publishing to npm leaves the previous, working installation
      target untouched — no partial/broken state is ever exposed.
- [ ] `README.md` documents the install process for both channels.

### Applicable Business Rules
| # | Rule | Type |
|---|---|---|
| RN-01 | No manual preparation step required to install | Mandatory |
| RN-02, RN-04 | What is installable always matches a published, validated version; a failed publish never degrades what is already available | Restrictive / Conditional |
| RN-03 | Preparing the installable artifact is automatic, part of the release process | Mandatory |
| RN-05 | The install command itself does not change | Restrictive |
| RN-06, RN-07 | Parity across supported AI assistants, without duplicating the release process | Mandatory / Restrictive |

### Task Sequencing
| # | Task | Scope | Depends on |
|---|---|---|---|
| TF-78-01 | Build + force-push the `dist` branch from the release job | Release pipeline | — |
| TF-78-02 | Branch protection on `dist` | Repository config | TF-78-01 |
| TF-78-03 | `marketplace.json` / `plugin.json` — structured source + explicit `mcpServers` | Plugin manifests | TF-78-01 |
| TF-78-04 | Empirical install smoke test on both channels | Validation | TF-78-02, TF-78-03 |
| TF-78-05 | README — document both install processes | Docs | TF-78-04 |

### Tasks

#### TF-78-01: [hermetic-diagrams] Build and force-push the `dist` branch from the release job
**User Story:** US-78 · **Priority:** P0

##### 1. Description & Objective
> **As the** release process, **I want** to build the compiled artifact and publish it to a
> dedicated branch right after a successful npm publish, **so that** anyone installing from git
> gets a ready-to-run plugin without needing to build it themselves.

##### 2. Technical Specification
**2.1 Interception points (update):** `.github/workflows/release-please.yml` — add a step (or
job) that runs only when `steps.release.outputs.release_created` is true **and** the `npm publish`
step has already succeeded.

**2.2 Content:**
1. Checkout the just-created tag (`ref: ${{ steps.release.outputs.tag_name }}`).
2. `npm ci && npm run build` (same build the npm package already ships).
3. `git add -f dist` (the only place `.gitignore` is deliberately bypassed, and only inside this
   job).
4. Commit and `git push --force` that commit to `origin dist` (a new orphan commit — do not
   attempt to preserve `dist` branch history across releases).
5. If the build step fails, the job must stop **before** touching the `dist` branch — no partial
   or broken snapshot is ever pushed.

**2.4 Zero Trust:** the force-push must be the **last** step, gated strictly behind `npm publish`
having already succeeded (never build-then-publish — always publish-then-build-dist, so an npm
publish failure can never leave a stale `dist` pointing at an unpublished version). Uses the same
`GITHUB_TOKEN`/permissions already granted to `release-please.yml` — no new secret.

##### 3. Visual Model
See the sequence diagram in [`plan.md` §2.2](plan.md) (success branch: publish → build → force-push;
failure branch: publish/build fails → `dist` untouched).

##### 4. Execution Guidance
**4.2 Steps:** 1) add the conditional step(s) to `release-please.yml`; 2) verify locally that
`git add -f dist` actually stages files despite the `.gitignore` entry (`git status` inside the
job, or a dry run); 3) confirm the push target is `dist`, not `main`.
**4.3 Validation:** trigger a real release (or a manual `workflow_dispatch` variant against a test
tag) and confirm the `dist` branch is created/updated with both source and `dist/` present.
**4.4 Constraints:** never add `dist` as a `push` trigger target in any workflow (would create a
CI loop) — confirmed today none of `ci.yml`/`pr-title.yml`/`release-please.yml` listen on it;
keep it that way.
**4.6 Exit criteria:** after a successful release, `git ls-tree origin/dist` shows `dist/cli/bin.js`
and the rest of the compiled output alongside the source tree.

##### 5. Definition of Done
- [ ] `dist` branch is created/force-pushed only after `npm publish` succeeds.
- [ ] A failed build/publish leaves the previous `dist` branch state untouched.
- [ ] No workflow triggers on pushes to `dist` (loop-free, verified).

---

#### TF-78-02: [hermetic-diagrams] Branch protection on `dist`
**User Story:** US-78 · **Priority:** P2

##### 1. Description & Objective
> **As the** maintainer, **I want** the `dist` branch writable only by the release workflow,
> **so that** no accidental human push can desynchronize it from what was actually released.

##### 2. Technical Specification
**2.1 Interception points (config, not code):** GitHub repository branch protection rule for
`dist` on `scrapup/hermetic-diagrams` (via `gh api repos/scrapup/hermetic-diagrams/branches/dist/protection` or the repo Settings UI).

**2.4 Zero Trust:** restrict push access to the release workflow's identity only; humans (including
the maintainer) push to `dist` through no path other than that workflow.

##### 4. Execution Guidance
**4.2 Steps:** 1) after TF-78-01's first successful run creates the branch, apply the protection
rule restricting direct pushes; 2) confirm a manual `git push` to `dist` from a local clone is
rejected.
**4.3 Validation:** attempt a manual push to `dist` and confirm it is refused; confirm the release
workflow's next run still succeeds (its token/identity is allow-listed).
**4.6 Exit criteria:** only the release workflow can write to `dist`; a manual push attempt fails
with a clear permission error.

##### 5. Definition of Done
- [ ] Branch protection rule applied to `dist`.
- [ ] Manual push to `dist` confirmed rejected.
- [ ] Release workflow confirmed still able to push (not locked out by its own rule).

---

#### TF-78-03: [hermetic-diagrams] `marketplace.json` / `plugin.json` — structured source + explicit `mcpServers`
**User Story:** US-78 · **Priority:** P0

##### 1. Description & Objective
> **As a** user on either supported AI assistant, **I want** the plugin manifest to point at the
> built `dist` branch and declare its MCP server explicitly, **so that** both Claude Code and
> GitHub Copilot CLI resolve it correctly.

##### 2. Technical Specification
**2.1 Interception points (update):** `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`.

**2.2 Content:**
- `marketplace.json` — the `hermetic-diagrams` plugin entry's `source` becomes the structured form
  `{ "source": "github", "repo": "scrapup/hermetic-diagrams", "ref": "dist" }` (plan.md §3.2).
- `plugin.json` — add `"mcpServers": ".mcp.json"` (plan.md §3.3). Leave `.mcp.json` itself
  unchanged for now (`${CLAUDE_PLUGIN_ROOT}` stays — the path-variable risk is resolved by TF-78-04,
  not guessed here).

**2.4 Zero Trust:** do not touch `.mcp.json`'s variable in this task — that would be guessing
ahead of the empirical validation this same US requires (plan.md §5.1, §6).

##### 4. Execution Guidance
**4.2 Steps:** 1) edit `marketplace.json`'s plugin entry; 2) edit `plugin.json` to add `mcpServers`;
3) keep `version` fields exactly as already synced by `release-please-config.json`'s `extra-files`
(no change to that sync mechanism).
**4.3 Validation:** `claude plugin validate .` passes; manually inspect the JSON for schema
correctness against the fields documented in `plan.md` §3.2/§3.3.
**4.6 Exit criteria:** both manifest files parse and validate; `source.ref` reads `dist`; `mcpServers`
present and pointing at `.mcp.json`.

##### 5. Definition of Done
- [ ] `marketplace.json` plugin entry uses the structured `source` with `ref: "dist"`.
- [ ] `plugin.json` declares `mcpServers` explicitly.
- [ ] `claude plugin validate .` passes.

---

#### TF-78-04: [hermetic-diagrams] Empirical install smoke test on both channels
**User Story:** US-78 · **Priority:** P0

##### 1. Description & Objective
> **As a** validator, **I want** to actually install the plugin through both Claude Code and
> GitHub Copilot CLI after a real release, **so that** the `${CLAUDE_PLUGIN_ROOT}` risk
> (plan.md §5.1) is proven, not assumed.

##### 2. Technical Specification
**2.1 No code changes expected**, unless the test fails — in which case this task's scope extends
to the concrete fix (e.g. adjusting the variable used in `.mcp.json`, or another approach decided
from the actual failure mode observed).

**2.4 Zero Trust:** this task **is** the resolution of the risk flagged in `plan.md` §5.1/§6 — do
not mark US-78 done without running it against a real, freshly-released `dist` branch.

##### 4. Execution Guidance
**4.2 Steps:** 1) after a release completes TF-78-01/02/03, run
`/plugin marketplace add scrapup/hermetic-diagrams` + `/plugin install hermetic-diagrams` in a
Claude Code session and confirm `list_formats` responds; 2) run
`copilot plugin marketplace add scrapup/hermetic-diagrams` + the Copilot CLI install/enable command
and confirm the MCP server starts there too; 3) if either fails, diagnose whether it is the
`${CLAUDE_PLUGIN_ROOT}` expansion and fix `.mcp.json` accordingly, then re-test.
**4.3 Validation:** both installs succeed with the MCP tools callable, with zero manual steps
beyond the documented install commands.
**4.6 Exit criteria:** confirmed working install on both channels from a real published release.

##### 5. Definition of Done
- [ ] Claude Code install confirmed working end-to-end, no manual step.
- [ ] Copilot CLI install confirmed working end-to-end, no manual step.
- [ ] Any fix required by this test is applied and re-validated (not left as a known issue).

---

#### TF-78-05: [hermetic-diagrams] README — document both install processes
**User Story:** US-78 · **Priority:** P1

##### 1. Description & Objective
> **As a** user, **I want** the README to show how to install this plugin from either Claude Code
> or GitHub Copilot CLI, **so that** I can pick the assistant I use without reading the source.

##### 2. Technical Specification
**2.1 Interception points (update):** `README.md` — "Install" section.

**2.2 Content:** add a "As a GitHub Copilot CLI plugin" subsection alongside the existing "As a
Claude Code plugin" one, with the exact `copilot plugin marketplace add` / install command
confirmed working in TF-78-04. Update the existing Claude Code subsection's note about building
`dist/` from source — that note described the gap this feature closes and is no longer accurate
once `dist` branch installs are in place.

##### 4. Execution Guidance
**4.2 Steps:** 1) add the Copilot CLI subsection; 2) correct/remove the now-stale
"build the plugin first" note under the Claude Code subsection; 3) keep the existing npm-install
subsection unchanged (unaffected by this feature).
**4.3 Validation:** manual review — every command shown matches what TF-78-04 actually confirmed
working.
**4.6 Exit criteria:** a new user can install from either assistant following only the README, with
no step that contradicts what TF-78-04 validated.

##### 5. Definition of Done
- [ ] Copilot CLI install instructions present and accurate.
- [ ] Stale "build from source" note corrected to reflect the `dist` branch mechanism.
- [ ] Every documented command matches what was actually validated in TF-78-04.

---

## Execution note

Recommended order: TF-78-01 → TF-78-02 (parallelizable with TF-78-03) → TF-78-03 → TF-78-04 →
TF-78-05. TF-78-04 is the gating task — nothing about `${CLAUDE_PLUGIN_ROOT}` compatibility with
Copilot CLI is assumed until it runs against a real release.
