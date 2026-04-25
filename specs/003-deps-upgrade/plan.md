# Implementation Plan: Whole-Repo Dependency Upgrade

**Branch**: `003-deps-upgrade` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-deps-upgrade/spec.md`

## Summary

Bump every dep in `package.json` (production + dev) to its latest published
version, including three majors (TypeScript 5.9 → 6.0, Vite 7.3 → 8.0,
`@vitejs/plugin-react` 5 → 6) and ~19 minors/patches. Tighten
`engines.node` to `">=22.12"` to match Vite 8's peer. Land a single PR onto
`main` from `003-deps-upgrade` that keeps `pnpm lint`, `pnpm test:coverage`
(≥50/50), `pnpm cf-typegen` (no diff), and `pnpm build` green. Drop & report
any individual bump that cannot be made green after a reasonable fix
attempt.

## Technical Context

**Language/Version**: TypeScript 6.0 (target), Node ≥22.12 (target).
**Primary Dependencies**: TanStack Start 1.167 + TanStack Router 1.168, Vite 8, React 19.2.5, Drizzle ORM 0.45.2, OpenAI 6.34, AWS S3 SDK 3.1037, nuqs 2.8.9, Zod 4, Biome 2.4.13.
**Storage**: Turso (SQLite, HTTP) — not touched.
**Testing**: Vitest 4.1.5 + `@vitest/coverage-v8` 4.1.5, happy-dom 20.9, `@testing-library/react` 16.3, `@testing-library/jest-dom` 6.9 — already on latest, no test code changes expected.
**Target Platform**: Cloudflare Workers (production); Node ≥22.12 (CI + local).
**Project Type**: Web app (TanStack Start front + serverless API in same repo).
**Performance Goals**: `pnpm test:coverage` < 60 s (constitution); CI overhead unchanged.
**Constraints**: deterministic tests; no real I/O; `cloudflare()` + `tanstackStart()` plugins remain isolated to `vite.config.mts` (Vitest config does **not** load them).
**Scale/Scope**: ≈22 dep bumps; zero new files outside `specs/003-deps-upgrade/**`; lockfile regeneration; possibly 1–3 surgical fixes in source if TS 6 surfaces new errors.

## Constitution Check

*Gate: must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| I. Test-First Pragmatism | ✅ No test deletions. Coverage thresholds (50/50/50/50) preserved. |
| II. Boundary Mocking | ✅ All boundary mocks unchanged. |
| III. Type-Safe Edges | ✅ TS 6 strictness errors (if any) fixed in code, not via `tsconfig` weakening. |
| IV. Cloudflare-First Simplicity | ✅ `vitest.config.ts` still excludes `cloudflare()` + `tanstackStart()`. Vite 8 + cloudflare/vite-plugin 1.33 verified peer-compatible (`vite: ^6 \| ^7 \| ^8`). |
| V. Observability | ✅ No `console.*` introductions. |

**Verdict**: All gates pass. No constitution violations; no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-deps-upgrade/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
├── tasks.md             # Phase 2 output (/speckit-tasks)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

(No `data-model.md` or `contracts/` — feature is infrastructural and adds zero domain entities or interfaces.)

### Source Code (repository root)

```text
purranormal-activity/
├── package.json                # MODIFIED — every dep bump, engines.node tightened to ">=22.12"
├── pnpm-lock.yaml              # REGENERATED — pnpm install after each cluster
├── vite.config.mts             # POSSIBLY MODIFIED — Vite 8 plugin API tweak (only if needed)
├── vitest.config.ts            # POSSIBLY MODIFIED — Vitest 4 + Vite 8 plugin compat (only if needed)
├── tsconfig.json               # POSSIBLY MODIFIED — only if TS 6 rejects an existing field
├── wrangler.jsonc              # POSSIBLY MODIFIED — only if wrangler 4.85 rejects a field
├── .github/workflows/lint.yml  # UNCHANGED expected
├── app/, components/, services/, utils/, hooks/, env/, start/, db/, drizzle/  # source — surgical fixes only if TS 6 surfaces new errors
└── specs/003-deps-upgrade/     # this feature dir
```

**Structure Decision**: Single-project layout (TanStack Start monorepo with co-located client + server routes) preserved. No new directories.

## Phase 0 — Outline & Research

See `research.md`.

Highlights (already verified pre-plan):

| Topic | Decision | Source |
|---|---|---|
| Vite 8 ↔ `@cloudflare/vite-plugin` 1.33 | Compatible (`peer vite: ^6 \| ^7 \| ^8`); requires wrangler ^4.85 (bumped). | `npm view @cloudflare/vite-plugin@1.33.2 peerDependencies` |
| `@vitejs/plugin-react` 6 | Forces Vite 8 (`peer vite: ^8.0.0`). Optional peers `@rolldown/plugin-babel`, `babel-plugin-react-compiler` NOT installed. | `npm view @vitejs/plugin-react@6.0.1 peerDependencies*` |
| Vite 8 Node engine | Requires `^20.19 \|\| >=22.12`; tighten `engines.node` to `>=22.12`. | `npm view vite@8.0.10 engines` |
| TanStack react-start 1.167 | Peer `vite: >=7.0.0` — Vite 8 satisfies. | `npm view @tanstack/react-start@1.167.49 peerDependencies` |
| TypeScript 6.0 risks | Real risk in `drizzle-orm` and `@tanstack/react-router` generated types. Verify with clean `pnpm build` + `pnpm cf-typegen`. Drop & report on failure. | Constitution + change policy. |
| Vitest 4 + Vite 8 | Vitest 4.1.5 already pinned; verify after Vite 8 bump that `vitest.config.ts` `react()` plugin still resolves. | Manual smoke. |

## Phase 1 — Design & Contracts

This feature has no domain entities and exposes no new interfaces. The
"contract" is implicit: every dep stays semver-compatible at the API
surface this codebase consumes. The `quickstart.md` documents the
verification recipe a reviewer can replay.

## Phase 2 — Implementation Approach (executed by `/speckit-implement`)

Three sequential phases (the project is too small to parallelise across
agents — file overlap on `package.json` + `pnpm-lock.yaml` would force
serial commits anyway):

**Phase A — patches & minors (low risk, single commit cluster):**

```
@biomejs/biome 2.4.4 → 2.4.13
@tailwindcss/postcss 4.2.1 → 4.2.4
tailwindcss 4.2.1 → 4.2.4
postcss 8.5.6 → 8.5.10
react 19.2.4 → 19.2.5
react-dom 19.2.4 → 19.2.5
@types/node 25.3.2 → 25.6.0
nuqs 2.8.8 → 2.8.9
@ai-sdk/openai 3.0.36 → 3.0.53
ai 6.0.103 → 6.0.168
openai 6.25.0 → 6.34.0
@tabler/icons-react 3.37.1 → 3.41.1
@tanstack/react-router 1.163.2 → 1.168.24
@tanstack/react-start 1.163.2 → 1.167.49
@cloudflare/vite-plugin 1.25.6 → 1.33.2
wrangler 4.69.0 → 4.85.0   (must precede Vite 8)
@libsql/client 0.17.0 → 0.17.3
drizzle-orm 0.45.1 → 0.45.2
drizzle-kit 0.31.9 → 0.31.10
lint-staged 16.2.7 → 16.4.0
@aws-sdk/client-s3 3.999.0 → 3.1037.0
```

After cluster: `pnpm install && pnpm cf-typegen && pnpm lint && pnpm test:coverage && pnpm build`. Commit: `chore(deps): bump minor/patch dependencies`.

**Phase B — TypeScript 5 → 6:**

- Bump `typescript` to `^6.0.3`.
- `pnpm exec tsc --noEmit` to surface new strictness errors.
- Fix code (do not weaken `tsconfig.json`).
- Re-run lint/test/build/cf-typegen.
- Commit: `chore(deps): bump typescript to 6`.

**Phase C — Vite 7 → 8 + plugin-react 5 → 6:**

- Bump `vite@^8.0.10` and `@vitejs/plugin-react@^6.0.1` together.
- Tighten `engines.node` to `">=22.12"`.
- Re-run full gate.
- Commit: `chore(deps): bump vite to 8 + plugin-react to 6`.

**Drop & report**: if any single bump fails after reasonable fix attempt,
revert the offending package(s) only, log under `## Skipped upgrades` in
the PR body, ship the rest.

## Complexity Tracking

*No constitution violations to justify. This section intentionally empty.*
