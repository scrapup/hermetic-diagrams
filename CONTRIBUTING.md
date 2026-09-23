# Contributing to hermetic-diagrams

Thanks for helping keep diagram rendering hermetic. This project has one non-negotiable invariant:
**diagram source must never leave the machine.** Every change is judged against it first.

## Dev setup

- **Node.js 24 LTS** (`.nvmrc` → `lts/krypton`). With nvm: `nvm install && nvm use`.
- **Docker** (Desktop or Engine). Integration and golden tests need a working Docker daemon that
  can run Linux containers.
- Install deps: `npm ci`.

## Build, lint, test

| Command | What it does |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` (`tsconfig.build.json`). |
| `npm run typecheck` | `tsc --noEmit`, strict, zero errors. |
| `npm run lint` | ESLint, zero errors (incl. `no-explicit-any`). |
| `npm test` | Unit suite (hermetic, no Docker). |
| `npm run test:coverage` | Unit suite with the coverage threshold. |
| `npm run test:integration` | Bring up the compose stack and render every notation e2e (Docker). |
| `npm run test:golden` | Golden exfiltration test — asserts zero sink hits (Docker). |

Run a **single** unit test file: `npx vitest run --project unit src/pep/security-scanner.spec.ts`
(or `npx vitest --project unit <file>` to watch).

## Security invariants that must never regress

These come from the repo `CLAUDE.md` and the SDD (`docs/specs/mvp/`). A change that weakens any of
them will not be merged:

1. The renderer runs on a Docker network with `internal: true` — **never** add a bridge/host network
   or publish its port.
2. Kroki is **headless**; the MCP is its **sole client**. `KROKI_SAFE_MODE=SECURE` stays on.
3. The MCP is a **Policy Enforcement Point**: per-notation validation, reject external references
   **before** rendering, disable XML DTD/entities, allowlist formats, enforce size/time limits, and
   fail-closed on anything it cannot parse with confidence.
4. The MCP has **no outbound HTTP client and no telemetry**; it reaches Kroki via **POST-with-body**,
   never GET-with-source-in-the-URL.
5. Output SVG is **sanitized** (parser + allowlist, never regex).
6. **Boot fail-closed**: egress self-check + canary + Kroki health must pass or the render tool is
   not registered.
7. **Never** render via a public server, not even as a fallback.

Add a test for any new external-reference vector (there is a case per vector per notation in
`src/pep/security-scanner.spec.ts` and `test/golden/`).

## SDD flow

Work derives from the specs in [`docs/specs/mvp/`](docs/specs/mvp/): `spec.md` (what/why),
`plan.md` (how), `tasks.md` (the backlog). Change the spec/plan before changing behavior.

## Image homologation (supply chain)

Images are pinned by `sha256` in [`images.lock`](images.lock); a mutable tag is never used. To bump
a digest:

1. Resolve the new digest (`docker buildx imagetools inspect <image>:<tag>`).
2. Update `images.lock` **and** `compose.yaml` with the new `@sha256:…` and the date.
3. Re-prove containment: `npm run test:golden` **and** `npm run test:integration` must pass with the
   new digest (every notation renders; the sink is never reached).
4. Only then promote. CI enforces this: the `homologation` job is gated on the `containment` job.

## Commit & PR conventions

- **Conventional Commits**, in English (`feat:`, `fix:`, `chore:`, `test:`, `ci:`, `docs:`).
- Keep commits scoped; reference the task id (`TF-xx-yy` / `US-xx`) when relevant.
- Open PRs against `main`. CI (`typecheck`, `lint`, `build`, unit + coverage, integration, golden)
  must be green.

## License

By contributing you agree your contributions are licensed under the MIT License.
