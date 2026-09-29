# Functional Specification: hermetic-diagrams (MVP)

> SDD Phase 1 — business intent (What / Why), technology-agnostic. The How (architecture,
> components, contracts) lives in `plan.md` (Phase 2).
> Agreed MVP scope: notations that render without browser components; a single entry point;
> on-demand environment setup; consumption by a local assistant/agent.

## 1. Overview and Objective

- **The Problem:** Turning a diagram's textual description into an image today leaks the content.
  The path of least resistance — for a person and for an AI assistant alike — is to delegate
  rendering to a public service on the internet. In that act, the diagram source (service names,
  topology, trust boundaries, and sometimes secrets in labels) is sent to a third party, exposed to
  logs, caches, and history outside the author's control. The safe choice (rendering locally)
  demands friction and discipline that rarely happen on their own.
- **The Solution (What):** A service that renders diagrams from text **entirely within the user's
  environment**, with a **structural guarantee** that the submitted content is **never transmitted
  outward** — containment is a property of the system, not a usage recommendation. The requester
  hands over the diagram text and gets the image back; nothing travels outside.
- **The Value (Why):** Sovereignty over one's own architecture — an engineering team's most
  sensitive material stops leaking on trivial tasks. It enables use where sending data outward is
  unacceptable (regulated environments, under confidentiality, or network-isolated) and removes, by
  construction, the exfiltration vector that the default behavior introduces.

## 2. User Journeys

Actors:
- **Requester** — the developer or the AI assistant/agent asking for the render.
- **Operator** — whoever installs and maintains the service in the environment.
- **System** — the contained rendering service (the subject of this spec).

**Main Journey — render with containment:**
1. The Requester provides the diagram text and the desired output format.
2. The System inspects the text and confirms it contains no references to the outside.
3. The System renders the diagram locally, inside the contained environment.
4. The System returns the image to the Requester.
5. Result: the image is produced and **no data left the environment**.

**Alternative Journey A — first use (environment not yet prepared):**
1. The Requester asks for a render for the first time.
2. The System detects the contained rendering environment is not ready yet.
3. The System prepares that environment on demand, reporting progress.
4. Once prepared, the System proceeds with the Main Journey.

**Alternative Journey B — content with an external reference:**
1. The Requester provides text that includes a reference to the outside (e.g., a remote resource,
   an include by address, an external entity).
2. The System **refuses** the render before any processing capable of fetching that resource,
   explaining why.
3. No attempt at external access ever occurs.

**Alternative Journey C — containment cannot be guaranteed:**
1. On startup, the System verifies the rendering environment is truly isolated from the outside.
2. If the verification fails, the System **refuses to operate** and reports the condition.
3. No rendering happens while containment is not proven.

**Alternative Journey D — invalid content:**
1. The Requester provides text that is not a valid diagram: format not declared or unknown,
   syntax incorrect for the notation, or empty content.
2. The System validates the request and **rejects it before rendering**, with a message describing
   what is wrong (reason and, when possible, the error location).
3. No rendering is attempted; the Requester fixes it and resubmits.

## 3. Business Rules and Constraints

| # | Rule | Type |
|---|---|---|
| RN-01 | No input data (diagram text) may be transmitted outside the user's environment, under any circumstance — not even as a fallback. | Restrictive |
| RN-02 | The System renders from text to image locally, without depending on any external service at runtime. | Mandatory |
| RN-03 | References to the outside in the content (remote includes/links, resources by address, external entities) must be blocked **before** any step able to resolve them. | Restrictive |
| RN-04 | If containment cannot be proven, the System does not operate (fail-closed). Refusing is preferable to rendering without a guarantee. | Conditional |
| RN-05 | The MVP scope covers only notations that render without browser components. Notations requiring a browser are deferred to a later cycle. | Restrictive |
| RN-06 | The rendering engine is never directly reachable; the only entry point is the System itself, which validates every request. | Restrictive |
| RN-07 | Input content must never appear in logs, addresses, or artifacts that could leave the environment. | Restrictive |
| RN-08 | Each version of the rendering environment is pinned and homologated; it is only promoted after re-confirming containment. | Mandatory |
| RN-09 | Every request is validated before rendering: the format must be declared and recognized, and the text must be syntactically valid for that notation. Invalid input is rejected with a descriptive error, without rendering. Security validation (RN-03) and validity validation (RN-09) are distinct steps: both occur before any rendering. | Mandatory |
| RN-10 | The MVP output formats are SVG (default) and PNG. | Mandatory |
| RN-11 | The output SVG is sanitized before delivery — `script`, `foreignObject`, and external references (remote `href`/`url`) are removed — so the delivered image emits no requests when displayed. Containment applies to input, to the rendering environment, **and to output**. | Restrictive |

MVP target notations (the concrete list is confirmed in `plan.md`): PlantUML, C4, D2, GraphViz,
DBML, ERD, Vega/Vega-Lite — all local-render, no browser.

## 4. Edge Cases and Exception Flows (Zero Trust)

| Scenario | Expected Behavior | Severity |
|---|---|---|
| Format/notation not declared or unknown | Reject with a clear error listing the available formats | Medium |
| Format known but out of MVP scope (e.g., requires a browser) | Reject with an explicit error that the notation is unavailable in this cycle | Low |
| Text syntactically invalid for the declared notation (requester error) | Reject before rendering, with a descriptive message (reason and, when possible, location); not a security failure | Medium |
| Empty or whitespace-only content | Reject with a clear error | Low |
| Invalid character encoding in the input | Reject with a clear error | Low |
| Text the validator cannot interpret safely | Refuse (fail-closed); never "try anyway" | High |
| Text with a remote include/link | Refuse before rendering; no external request is emitted | Critical |
| Text with an external entity (XML content) | Neutralize/refuse; never resolve the entity | Critical |
| Rendered SVG contains script, foreignObject, or an external reference | Sanitize (remove) before delivery; the delivered image makes no requests when displayed | Critical |
| Containment not provable at startup | Refuse to operate and report the condition | Critical |
| Excessively large diagram or slow render | Cap by size and by time; end with a clear error | Medium |
| Environment setup interrupted on first use | Report failure; do not render until the environment is ready and contained | High |

## 5. Success Criteria and SLAs

**Functional Criteria:**
- [ ] All journeys (Main, A, B, C, D) execute as described.
- [ ] Rules RN-01 through RN-11 validated.
- [ ] The MVP target notations render to image successfully.
- [ ] Invalid inputs (unknown format, incorrect syntax, empty content) are rejected with a descriptive error, without rendering.

**Containment Criteria (non-negotiable):**
- [ ] A test proves **zero network egress** during a render: a diagram with an external reference
  pointing to a controlled sink **never** reaches it.
- [ ] The System refuses to operate when containment is not proven (fail-closed verified).
- [ ] The delivered SVG contains no script, foreignObject, or external references (sanitization verified).

**SLAs (initial targets, to be calibrated in `plan.md`):**
- Latency: a typical diagram rendered at interactive speed once the environment is ready (initial
  reference target: a few seconds; exact value defined in Phase 2).
- First use: slower due to environment setup; must report progress.
- Availability: local and on demand; no dependency on external services at runtime.

## 6. Glossary

| Term | Definition in this context |
|---|---|
| Data exfiltration | Unauthorized outflow of content from the user's environment to third parties. |
| Containment (hermetic) | The property that the rendering environment has no path to the outside — the guarantee is structural, not behavioral. |
| External reference | Any construct in the diagram text pointing to a resource outside the environment (remote link/include, resource by address, external entity). |
| Fail-closed | When in doubt or unable to guarantee containment, the System refuses rather than proceeding. |
| Local-render notation | A diagram format that produces an image without requiring a browser. |
| Requester | Developer or AI assistant/agent asking for the render. |
