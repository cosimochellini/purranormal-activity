# Feature Specification: Whole-Repo Dependency Upgrade

**Feature Branch**: `003-deps-upgrade`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "Upgrade every dependency in package.json to its latest published version, including the three majors (TypeScript 5→6, Vite 7→8, @vitejs/plugin-react 5→6) and all minors/patches. Land in a single PR onto main from branch 003-deps-upgrade. Tighten engines.node to >=22.12 so Vite 8's peer requirement is satisfied. Keep the project green: pnpm lint, pnpm cf-typegen (no diff), pnpm test:coverage (≥50% lines AND ≥50% branches preserved), pnpm build. If a specific bump cannot be made green after a reasonable fix attempt, revert that bump and document it under a 'Skipped upgrades' section. Do not introduce new behaviour, refactors, or new tests beyond what is needed to keep the existing ~270-test suite green. Success criteria mirror Constitution Quality Gates §1–5 plus zero P0/P1/P2 findings from /gh-pr-no-checkout-review on the resulting PR within at most three review iterations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Single PR Bumps Every Dependency to Latest (Priority: P1)

As the project maintainer, when I open the next PR after the hardening
release, I want every dependency in `package.json` (production and dev) on
its latest published version, so the project stays current on Vite 8,
TypeScript 6, and the rest of the ecosystem without paying the cumulative
bump-cost in three months.

**Why this priority**: Living on stale majors compounds — every additional
month makes Vite 7→8 and TypeScript 5→6 harder, because each downstream
plugin (`@cloudflare/vite-plugin`, `@tanstack/react-start`, `vitest`) keeps
moving. Bumping everything in one coordinated PR is the cheapest way to
stay green.

**Independent Test**: Run `pnpm outdated` after the PR merges; the table
prints zero rows (or only rows representing skipped upgrades documented in
the PR body).

**Acceptance Scenarios**:

1. **Given** the merged PR, **When** a contributor runs `pnpm install`,
   **Then** the lockfile resolves cleanly and no dep stays on a previous
   major (subject to the documented Skipped Upgrades list).
2. **Given** the merged PR, **When** CI runs `pnpm lint` and
   `pnpm test:coverage`, **Then** both succeed; coverage stays at ≥50% lines
   AND ≥50% branches; no test count drop versus `main`.
3. **Given** the merged PR, **When** CI runs `pnpm build`, **Then** the Vite
   build (now on Vite 8) emits `dist/server/wrangler.json` for `wrangler
   deploy` and exits zero.
4. **Given** the merged PR, **When** a contributor runs `pnpm cf-typegen`,
   **Then** there is no diff against the committed
   `worker-configuration.d.ts`.

---

### User Story 2 — Skipped Upgrades Are Auditable (Priority: P2)

As a reviewer, when a specific bump cannot be made green after a reasonable
fix attempt, I need the PR body to call out the skip explicitly and explain
why, so I can decide whether the regression is acceptable and triage it
later.

**Why this priority**: A silent skip is a hidden technical-debt item; an
auditable skip becomes a follow-up ticket. P2 because P1 delivers the
upgrade itself; this story makes the skip *visible*.

**Independent Test**: After the PR is opened, the PR description always
contains a `## Skipped upgrades` section. If the section is empty, it
states "(none)". Each non-empty entry names the package, the attempted
target version, and the failure mode (link to the failing CI run if
applicable).

**Acceptance Scenarios**:

1. **Given** every bump succeeds, **When** the PR is opened, **Then** the
   `## Skipped upgrades` section reads "(none)".
2. **Given** at least one bump cannot be made green, **When** the PR is
   opened, **Then** the section lists each skipped package, its target
   version, and the reason in one or two lines.

---

### User Story 3 — `/gh-pr-no-checkout-review` Reports Zero P0/P1/P2 (Priority: P3)

As a maintainer, before I merge, I need an independent zero-context review
agent to confirm the PR introduces no new P0/P1/P2 issues; otherwise the
upgrade has hidden costs that defeat the purpose of staying current.

**Why this priority**: P3 because Stories 1 and 2 deliver the upgrade and
audit-trail; this story is the *quality gate* that backs the whole
operation. The review agent is not a substitute for tests but a second
opinion.

**Independent Test**: Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh
session. The output reports zero P0, zero P1, and zero P2 findings.

**Acceptance Scenarios**:

1. **Given** the PR is open and CI is green, **When** `/gh-pr-no-checkout-review`
   runs, **Then** it returns no P0/P1/P2 items (P3 noise is acceptable).
2. **Given** the agent reports issues, **When** the maintainer fixes them
   and re-runs, **Then** within at most three iterations the report is
   clean.

### Edge Cases

- A bump introduces a new transitive peer that pnpm refuses to install →
  treat as failure for that single bump; record under Skipped Upgrades.
- A bump silently changes runtime behaviour (e.g., AWS SDK changes default
  retry policy) but every test passes → covered by the manual smoke step
  in the verification plan.
- TypeScript 6 introduces a new strictness error in production code → fix
  the code, do **not** loosen `tsconfig.json`.
- Vite 8 fails to load with `cloudflare()` or `tanstackStart()` plugin →
  open a follow-up issue and revert Vite to 7 in the same PR; record
  Skipped Upgrades.
- A test starts failing only because a mock target API drifted (e.g.,
  `nuqs/adapters/tanstack-router` rename) → update the mock; do **not**
  delete the test.
- `engines.node` tightening to `>=22.12` blocks a contributor on Node 22.0 →
  acceptable: Vite 8 itself enforces this; ours just makes it explicit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every dependency listed in `package.json#dependencies` and
  `package.json#devDependencies` MUST be on its latest published version,
  except items explicitly listed in the PR body's Skipped Upgrades section.
- **FR-002**: `package.json#engines.node` MUST be tightened from `"22.x"`
  to `">=22.12"` to satisfy Vite 8's peer requirement.
- **FR-003**: `pnpm install --frozen-lockfile` MUST succeed against the
  committed `pnpm-lock.yaml`.
- **FR-004**: `pnpm lint`, `pnpm test:coverage`, `pnpm cf-typegen`, and
  `pnpm build` MUST all exit zero against the merged state.
- **FR-005**: Coverage thresholds (50/50/50/50) configured in
  `vitest.config.ts` MUST be retained; no threshold MAY be lowered to make
  the build pass.
- **FR-006**: The PR description MUST contain a `## Skipped upgrades`
  section. The section MUST list every dep that was reverted along with
  reason and target version, or be the literal text "(none)".
- **FR-007**: No production source file (under `app/`, `components/`,
  `start/`, `services/`, `utils/`, `hooks/`, `env/`) MAY introduce new
  behaviour, new error handling beyond what the upgrade requires, new
  comments beyond what the upgrade requires, new feature flags, or new
  tests outside of what is required to keep the existing suite green.
- **FR-008**: The PR MUST be a single PR onto `main` from
  `003-deps-upgrade`. Conventional Commit prefix is `chore(deps)`.
- **FR-009**: The CI workflow `.github/workflows/lint.yml` MUST stay
  unchanged unless a bump (e.g., wrangler 4.85, pnpm 9 → 10) requires a
  specific CI tweak; any change MUST be documented in the PR body.
- **FR-010**: After three iterations of `/gh-pr-no-checkout-review` (run
  by zero-context subagents), the report MUST contain zero P0/P1/P2 items
  before the PR is merged.

### Key Entities *(this feature is infrastructural — no new domain entities)*

- **Dependency Bump Set**: The frozen list of all dep upgrades attempted
  in this PR (≈22 entries), each with current version, target version,
  outcome (`merged` | `skipped`), and (if skipped) reason.
- **Skipped Upgrades List**: A subset of the bump set with outcome `skipped`,
  surfaced in the PR body for reviewer audit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After merge, `pnpm outdated` reports zero rows (or only rows
  matching the documented Skipped Upgrades list).
- **SC-002**: `pnpm test:coverage` continues to report ≥50% lines AND ≥50%
  branches globally on the merged state.
- **SC-003**: The Vitest test count on the merged state is **>=** the test
  count on `main` at branch-off (regression test count must not drop).
- **SC-004**: The CI pipeline (`lint` + `test` jobs in
  `.github/workflows/lint.yml`) goes green on the PR.
- **SC-005**: `pnpm build` produces a `dist/server/wrangler.json` and the
  build exits zero.
- **SC-006**: `/gh-pr-no-checkout-review` reports zero P0, zero P1, and zero
  P2 findings on the PR within at most three review iterations.
- **SC-007**: Local `pnpm preview` smoke (home, `/explore`, `/new`, `/[id]`,
  `/[id]/edit`) renders without console errors on the merged build.

## Assumptions

- The repository remains on Cloudflare Workers (TanStack Start + Vite); no
  framework migration is bundled with this upgrade.
- `pnpm` v9 (CI) and Node ≥22.12 (local + CI) are available — the engine
  bump matches Vite 8's peer.
- The constitution's principles (Test-First, Boundary Mocking, Type-Safe
  Edges, Cloudflare-First, Observability) remain unchanged.
- The existing ~270-test suite from feature 001 is the single source of
  behavioural truth; no new tests are required if every dep stays
  backwards-compatible at the API surface this codebase consumes.
- Optional peers introduced by `@vitejs/plugin-react@6`
  (`@rolldown/plugin-babel`, `babel-plugin-react-compiler`) are NOT
  installed.
- `wrangler` ≥ 4.85 is required by `@cloudflare/vite-plugin` 1.33; the
  upgrade includes wrangler 4.69 → 4.85 to satisfy the peer.
- `pnpm-lock.yaml` is regenerated and committed; no separate npm/yarn
  lockfile exists.
- No real Turso, OpenAI, R2, Telegram, or Cloudflare Images credentials
  are required to verify the upgrade.
- Husky + lint-staged behaviour stays unchanged.
