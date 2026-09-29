# Functional Specification: Reliable plugin distribution across AI-assistant marketplaces

> SDD Phase 1 — business intent (What / Why), technology-agnostic. The How (architecture,
> components, contracts) lives in `plan.md` (Phase 2).

## 1. Overview and Objective

- **The Problem:** the install channels recommended today — the marketplaces of the compatible AI
  assistants (currently Claude Code and GitHub Copilot CLI) — do not deliver a working
  installation. Anyone who follows the documented instructions exactly to install the plugin ends
  up with a service that does not start, because what those channels make available does not
  correspond to something ready to run. The breakage only surfaces after installation, on the
  first attempt to use it.
- **The Solution (What):** guarantee that installing through any supported marketplace delivers,
  always and with no manual step from the user, a version ready to use — matching exactly the
  latest version published and validated by the project's release process. The fix must hold
  equivalently across every supported channel, without each one requiring a separate publishing
  process.
- **The Value (Why):** removes the friction that today blocks adoption through the channels the
  project itself recommends as the preferred way to install, on any compatible AI assistant.
  Preserves the confidence that what reaches whoever installs is always something already
  validated — never an intermediate, partial, or untested state — keeping the same quality
  guarantee the release process already offers through other distribution channels.

## 2. User Journeys

Actors:
- **User** — whoever installs and uses the plugin through a compatible AI assistant (Claude Code,
  GitHub Copilot CLI, or another one that comes to be supported).
- **Maintainer** — whoever completes and publishes a new version of the project.
- **System** — the version publishing and distribution process.

**Main Journey — installation via marketplace:**
1. The User runs, on the AI assistant of their choice, that assistant's own plugin marketplace
   install command.
2. The System makes available a version already ready to run, with no additional preparation
   required from the User — regardless of which compatible AI assistant the User is using.
3. The User starts using the plugin's tools immediately after installation.
4. Result: the installation works on first use, on any of the supported channels.

**Alternative Journey A — a new version is published:**
1. The Maintainer completes the release process for a new version of the project.
2. The System updates, as part of that same process, what gets delivered to whoever installs or
   updates the plugin — reflecting the new version.
3. No manual action beyond the already-existing release process is needed for the new version to
   become available for installation.

**Alternative Journey B — publishing a new version fails (Zero Trust):**
1. For any reason, the process of publishing a new version is interrupted or fails before
   completing.
2. The System does **not** make available, to whoever is about to install, a partial,
   inconsistent version, or one corresponding to a development state that never completed the
   release process.
3. Whoever already has a previous version installed keeps it working normally, with no impact,
   until a new version is published successfully.

## 3. Business Rules and Constraints

| # | Rule | Type |
|---|---|---|
| RN-01 | Installing via marketplace must work without requiring the user to run any manual preparation step before first use. | Mandatory |
| RN-02 | What is delivered to whoever installs must match exactly a version already published and validated by the release process — never an intermediate or unvalidated development state. | Restrictive |
| RN-03 | Preparing what is delivered to whoever installs is an automatic responsibility of the release process — never a manual task the Maintainer repeats for every version. | Mandatory |
| RN-04 | A failure while preparing what is delivered to whoever installs must never silently result in a broken installation being made available — the failure must block updating what is available, preserving the last intact version. | Conditional |
| RN-05 | The install command used by the User, on each compatible AI assistant, does not change because of this functionality — the fix happens entirely on the side of whoever prepares and makes the version available. | Restrictive |
| RN-06 | The fix must work equivalently across every compatible AI assistant supported by the project — no channel may remain broken while another is fixed. | Mandatory |
| RN-07 | Supporting an additional AI assistant must not require duplicating the version-publishing process — the same publish must feed every supported channel. | Restrictive |

## 4. Edge Cases and Exception Flows (Zero Trust)

| Scenario | Expected Behavior | Severity |
|---|---|---|
| User installs before any fixed version has been published | Same behavior as today (no additional regression); the fix only applies starting from the first version published after this functionality | Medium |
| The process of publishing a new version fails partway through | What is available for installation stays at the last successfully published version; no partial version is ever exposed | Critical |
| User already installed a previous version and does not update | Keeps working normally, no impact | Low |
| What is delivered to whoever installs does not match the source code of the published version (drift) | Must be detectable before reaching whoever installs, and must prevent that drift from being made available | High |
| Two overlapping/concurrent version publications | The most recent one completed successfully is what stays available; no intermediate state from an incomplete publication is ever visible | High |
| The installation works on one compatible AI assistant but not on another (channel-specific configuration not recognized by the other) | Treated as a failure of the functionality — the fix is not complete until it works on every supported channel; it is not acceptable to release the fix for one channel while leaving another pending without notice | High |

## 5. Success Criteria and SLAs

**Functional Criteria:**
- [ ] Installing via marketplace and using the plugin's tools works on first use, with no manual
      step from the User, on **every** compatible AI assistant supported by the project.
- [ ] What is available for installation matches exactly the latest version published
      successfully by the release process, across every channel.
- [ ] A failure in the version-publishing process never leaves a broken installation available —
      the previous, intact version stays available.
- [ ] Supporting a new compatible AI assistant does not duplicate the existing
      version-publishing process.

**SLAs:**
- New-version availability: as soon as a version's release process completes successfully, with
  no additional manual step and no perceptible delay for the User.
- Consistency: 100% match between the published version and what is delivered to whoever
  installs — zero tolerance for drift, given the restrictive nature of RN-02 and RN-04.

## 6. Glossary

| Term | Definition in this context |
|---|---|
| Compatible AI assistant | A tool (Claude Code, GitHub Copilot CLI, or another one that comes to be supported) able to discover and install this plugin through its own marketplace mechanism. |
| Marketplace | The mechanism, specific to each compatible AI assistant, through which a user discovers and installs this plugin. |
| Install channel | Synonym for marketplace, in the context of a specific compatible AI assistant. |
| Ready-to-use installation | The state in which, immediately after being installed, the plugin runs its tools without requiring any additional preparation step from the user. |
| Release process | The already-existing flow that validates, versions, and publishes a new version of the project (out of scope for this spec — referenced only as the trigger). |
| Intact version | A version that completed the release process successfully, as opposed to an intermediate development state or an interrupted publication. |
