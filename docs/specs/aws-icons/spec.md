# Functional Specification: AWS architecture icons and authoring guides, contained

> SDD Phase 1 — business intent (What / Why), technology-agnostic. The How (architecture,
> components, contracts) lives in `plan.md` (Phase 2).
> Agreed scope (discovery, 2026-10-14): an icon set pre-downloaded and shipped with the System;
> a reserved reference convention resolved only against that set; a maintainer-driven update path
> with scheduled detection; icon discovery; the simplified/experimental variants and dark mode;
> authoring guidance served to the Requester for AWS diagrams of every kind **and** for every
> notation the System already supports.

## 1. Overview and Objective

- **The Problem:** AWS architecture diagrams are among the most sensitive material an engineering
  team produces — they map accounts, services, data stores and trust boundaries. The official
  AWS icon set for text diagrams (`awslabs/aws-icons-for-plantuml`) is documented to be consumed
  **by address on the internet**: every published example pulls the icon definitions remotely at
  render time. The System, by design, refuses any remote reference (MVP RN-03), so today a
  Requester cannot produce an AWS-styled diagram at all — and the only alternative on offer, a
  public renderer that fetches the icons, is exactly the exfiltration path the System exists to
  remove.
- **The Solution (What):** make the AWS icon set **available locally, as part of the System**. The
  icon definitions are downloaded ahead of time from a pinned, verified upstream release and
  shipped with each version of the System. The Requester references icons through a reserved,
  familiar convention; the System resolves those references **only** against the shipped set,
  never against anything outside. A maintainer-facing mechanism detects new upstream releases and
  proposes the update, which is promoted only after containment is re-proven. So that an AI
  Requester produces valid diagrams on the first attempt, the System also **teaches how to author
  them**: it serves, on request, authoring guidance for each kind of AWS diagram and for each
  notation it supports — conventions, building blocks, and examples proven to render under the
  System's own containment rules.
- **The Value (Why):** teams get first-class AWS architecture diagrams with the same structural
  guarantee as every other render — the diagram source never leaves the environment, and no icon
  is ever fetched at render time. The icon set stays current without anyone weakening containment
  to get there. Authoring guidance served by the System itself removes the AI's tendency to fall
  back on what it learned from the internet — remote includes, public-renderer idioms — which the
  System would refuse, cutting failed render attempts.

## 2. User Journeys

Actors:
- **Requester** — the developer or AI assistant/agent asking for the render.
- **Maintainer** — whoever publishes new versions of the System.
- **Upstream** — the official AWS icon project, the sole origin of the icon set.
- **System** — the contained rendering service, extended by this feature.

**Main Journey — render an AWS diagram:**
1. The Requester writes a diagram that references the shared AWS base definitions and the icons it
   needs, using the reserved convention (e.g. `AWSPuml/AWSCommon.puml`,
   `AWSPuml/Compute/Lambda.puml`).
2. The System verifies that every reserved reference names an item of the shipped icon set.
3. The System substitutes each reference with the corresponding shipped definition, producing a
   self-contained diagram.
4. The System applies every existing containment check to the self-contained diagram and renders
   it locally.
5. Result: the AWS-styled image is returned; no data left the environment and nothing was fetched.

**Alternative Journey A — icon discovery:**
1. The Requester asks which AWS icons are available, optionally filtered by category or by part of
   a name.
2. The System answers from the shipped icon set: each icon's category, name and the exact reference
   line to use, plus the icon-set version in force.

**Alternative Journey B — unknown icon:**
1. The Requester references an icon that is not part of the shipped set (typo, renamed or removed
   upstream, or invented).
2. The System **refuses** the render before any processing, naming the unresolved reference and
   pointing to icon discovery. No partial render is produced.

**Alternative Journey C — remote AWS reference:**
1. The Requester pastes the upstream's documented form — the icon set by internet address, or the
   reserved name redefined to point at an address.
2. The System **refuses** the render (MVP RN-03 holds unchanged) and states the reserved local
   convention to use instead.

**Alternative Journey D — icon-set update (Maintainer):**
1. On a regular schedule, the System's maintenance process checks whether Upstream published a new
   release.
2. If so, it downloads that release, verifies its integrity, inspects every definition with the
   same containment rules applied to Requester input, and proposes the update for human review —
   including the catalog difference (icons added, removed, renamed).
3. The Maintainer reviews the proposal; the update is promoted only after the containment proofs
   pass with the new set.
4. If the update removes or renames icons, it is published as a breaking version, because existing
   diagrams that use them would stop rendering.

**Alternative Journey E — dark mode / simplified styles:**
1. The Requester opts into the upstream's dark style, or into the simplified/experimental base
   definitions, using the same reserved convention.
2. The System resolves them from the shipped set exactly like any other icon reference.

**Alternative Journey F — learn how to author a diagram:**
1. Before writing a diagram, the Requester (typically an AI assistant) asks the System which
   authoring guides exist.
2. The System lists the available guides: one per supported notation, and one per kind of AWS
   diagram (e.g. architecture with groups such as account/region/VPC/subnet, sequence with AWS
   participants, C4 with AWS icons, simplified style, dark mode).
3. The Requester asks for a specific guide.
4. The System returns it: purpose of the diagram kind, the reserved references to use, building
   blocks and conventions, what the System refuses (and the allowed alternative), and complete
   examples.
5. The Requester writes the diagram following the guide and renders it through the Main Journey.
6. Result: the first render succeeds; no guide ever suggests anything the System would refuse.

## 3. Business Rules and Constraints

| # | Rule | Type |
|---|---|---|
| RN-01 | The AWS icon set is **never fetched at render time**. It is downloaded ahead of time, verified, and shipped with each version of the System. | Restrictive |
| RN-02 | Reserved references (`AWSPuml/...`) resolve **only** against the shipped icon set (an allowlist). Any reserved reference that does not name a shipped item is refused (fail-closed); no fallback to any other origin exists. | Restrictive |
| RN-03 | The MVP rule against external references (MVP RN-03) is not relaxed: the upstream's by-address form and any redefinition of the reserved name to an address are refused. | Restrictive |
| RN-04 | After substitution, the self-contained diagram goes through **every** existing containment check before rendering. The shipped definitions are not trusted by origin; they are checked like Requester input. | Mandatory |
| RN-05 | AWS icons are available in the general text-diagram notation and in its C4 architecture variant. | Mandatory |
| RN-06 | Two size limits apply: the existing limit on the Requester's source (unchanged) and a separate, configurable limit on the self-contained diagram after substitution. Exceeding either refuses the render. | Mandatory |
| RN-07 | Each System version ships exactly **one** pinned Upstream release. Its identity (release tag) and integrity fingerprints are recorded with the System and reported by icon discovery. | Mandatory |
| RN-08 | An icon-set update is promoted only after re-proving containment with the new set (same bar as engine updates, MVP RN-08), and only through human review — never merged automatically. | Mandatory |
| RN-09 | During an update, any upstream definition that would itself reach outside (remote reference, environment read, external entity) blocks the update; it is never shipped. | Restrictive |
| RN-10 | Versioning: an icon-set update is a feature release; removing or renaming any icon is a breaking release, signalled as breaking in the change history. While the System is pre-1.0 (MVP), a breaking release follows the 0.x convention (minor version bump); from 1.0 onward it is a major bump. The update proposal states the catalog difference. | Mandatory |
| RN-11 | The shipped icons keep their upstream license and attribution (icons: CC-BY-ND 2.0 — redistributed unmodified; code: MIT). The System does not alter icon definitions. | Restrictive |
| RN-12 | Reserved references and icon content never appear in logs; only counts and the icon-set version may be logged (MVP RN-07). | Restrictive |
| RN-13 | The System serves authoring guidance on request: a listing of available guides and the content of each guide. Coverage: **every** notation the System supports for rendering, and **every** kind of AWS diagram in scope (architecture with groups, sequence, C4 with AWS, simplified style, dark mode). A supported notation without a guide is a defect. | Mandatory |
| RN-14 | Every example in a guide is proven: it must pass all containment checks and render successfully with the shipped engine and icon set. Guides never recommend remote references, public renderers, or any construct the System refuses; where a common internet idiom is refused, the guide states the allowed alternative. | Restrictive |
| RN-15 | Guides are part of the System version: shipped with it, versioned with it, available offline, and they reference the icon-set version in force. Guides are never fetched from outside. | Restrictive |
| RN-16 | Guides are concise and targeted (one guide per notation or per AWS diagram kind) so an AI Requester can load only what it needs. | Mandatory |

## 4. Edge Cases and Exception Flows (Zero Trust)

| Scenario | Expected Behavior | Severity |
|---|---|---|
| Reserved reference to an icon not in the shipped set | Refuse before rendering; name the unresolved reference; point to icon discovery | High |
| Reserved reference attempting to escape the set (`AWSPuml/../…`, absolute path, encoded separators) | Refuse as an invalid reference; never resolved | Critical |
| Reserved name redefined to an internet address, or upstream by-address include | Refuse as external reference (RN-03) | Critical |
| Same icon referenced several times | Substituted once; the render is equivalent | Low |
| Shipped definition referencing another shipped definition (nested) | Resolved transitively within the set; cycles and excessive depth refused | Medium |
| Self-contained diagram exceeds the post-substitution limit | Refuse with a size error stating both limits | Medium |
| Shipped set fails its integrity check at startup (tampered/corrupt) | The System refuses AWS references (or refuses to start — decided in Phase 2); never renders with an unverified set | Critical |
| Upstream unreachable / no new release during the scheduled check | No proposal; the check reports and ends; shipped set unchanged | Low |
| Upstream release fails integrity or containment inspection | Update blocked and reported to the Maintainer; nothing proposed | Critical |
| Upstream release removes/renames icons | Proposal flagged as breaking, with the list of affected icons | High |
| Discovery filter matches nothing | Empty result with the icon-set version; not an error | Low |
| Guide requested for an unknown notation or diagram kind | Refuse with the list of available guides; not a render error | Low |
| A guide example stops rendering after an engine or icon-set update | The update is blocked (same gate as RN-08) until the guide is fixed | High |
| A notation is added to or removed from the supported set | Its guide is added/removed in the same version; the guide listing never names an unsupported notation | Medium |

## 5. Success Criteria and SLAs

**Functional Criteria:**
- [ ] A diagram using `AWSPuml/AWSCommon.puml` plus individual icons renders (SVG and PNG) in both
      notations of RN-05, with no outbound traffic.
- [ ] The golden exfiltration test covers the AWS paths: the upstream by-address form and a
      redefined reserved name aimed at a controlled sink are refused and the sink receives nothing.
- [ ] Unknown icons and escape attempts are refused before rendering.
- [ ] Icon discovery lists the shipped set filtered by category/name and reports its version.
- [ ] The scheduled check opens an update proposal for a newer upstream release, including the
      catalog difference; a release containing an outbound reference is blocked.
- [ ] Dark mode and the simplified/experimental bases render.
- [ ] The guide listing names one guide per supported notation and one per AWS diagram kind of
      RN-13; every example in every guide renders through the full containment pipeline in CI.
- [ ] No guide contains a construct the System refuses (checked automatically, not by review).

**Performance SLAs** *(proposed — confirm in review)*:
- Substitution overhead: < 50 ms at P95 for a diagram with up to 50 icon references.
- Post-substitution size limit default: 2 MiB.
- Update check cadence: weekly.
- Package size growth from the shipped set: reported in the update proposal; budget to be set in
  Phase 2 after measuring the release.

**Quality Criteria:**
- [ ] Unit coverage stays ≥ 80% (existing gate).
- [ ] Integration tests for every edge case above marked Critical/High.

## 6. Glossary

| Term | Definition in this context |
|---|---|
| Icon set | The upstream AWS icon definitions for text diagrams, at one pinned release |
| Shipped set | The icon set as downloaded, verified and packaged with a System version |
| Reserved reference | An include using the `AWSPuml/` prefix, resolvable only against the shipped set |
| Substitution | Replacing each reserved reference with the shipped definition it names, producing a self-contained diagram |
| Self-contained diagram | A diagram with no remaining reference to anything outside its own text |
| Base definitions | `AWSCommon` (required), `AWSSimplified` and `AWSExperimental` (optional styles) |
| Catalog difference | Icons added, removed and renamed between two upstream releases |
| Update proposal | A reviewable change produced by the scheduled check; promoted only by a human |
| Authoring guide | Guidance served by the System on how to write one notation or one kind of AWS diagram: conventions, building blocks, refused constructs with alternatives, and proven examples |
| AWS diagram kind | A purpose-specific use of the icon set: architecture with groups, sequence, C4 with AWS, simplified style, dark mode |
