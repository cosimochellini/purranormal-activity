---
description: "Task list for whole-repo dependency upgrade"
---

# Tasks: Whole-Repo Dependency Upgrade

**Input**: Design documents from `/specs/003-deps-upgrade/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Existing ~270-test Vitest suite is the regression net. NO new
test tasks. NO test deletions.

**Organization**: Tasks are grouped by user story per spec-kit convention.
This is an infrastructural feature so the bulk of work falls under US1 (the
upgrade itself); US2 and US3 are documentation/audit tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies). Note: most
  tasks here serialise on `package.json` + `pnpm-lock.yaml`, so [P] is
  rarely applicable.
- **[Story]**: Maps task to user story (US1, US2, US3).

## Path Conventions

Single-project layout. Repo root: `/Users/cosimochellini/Documents/projects/purranormal-activity/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify clean baseline before any bumps.

- [ ] T001 Verify current branch is `003-deps-upgrade`, working tree clean — `git status -sb`.
- [ ] T002 Capture baseline: `pnpm test:coverage` count + lines/branches percentages — record in commit message of T020 for diff comparison.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prerequisites for ANY bump.

- [ ] T003 Confirm `pnpm install` from `pnpm-lock.yaml` resolves cleanly on `main` baseline (sanity).
- [ ] T004 Read `pnpm outdated` output and reconcile against the bump list in `plan.md` Phase A. Note any drift since the plan was written.

**Checkpoint**: Baseline reproducible. Bump phases unblocked.

---

## Phase 3: User Story 1 — Single PR Bumps Every Dependency to Latest (Priority: P1) 🎯 MVP

**Goal**: Every dep on its latest published version (or explicitly skipped + documented).

**Independent Test**: After PR merges, `pnpm outdated` prints zero rows (or only documented skips); `pnpm lint`, `pnpm test:coverage`, `pnpm cf-typegen`, `pnpm build` all green.

### Phase A — patches & minors

- [ ] T005 [US1] Bump biome 2.4.4 → 2.4.13 in `package.json` via `pnpm add -D @biomejs/biome@latest`.
- [ ] T006 [US1] Bump tailwind chain in `package.json`: `pnpm add -D @tailwindcss/postcss@latest tailwindcss@latest postcss@latest`.
- [ ] T007 [US1] Bump react chain in `package.json`: `pnpm add react@latest react-dom@latest && pnpm add -D @types/react@latest @types/react-dom@latest @types/node@latest`.
- [ ] T008 [US1] Bump nuqs 2.8.8 → 2.8.9 in `package.json` via `pnpm add nuqs@latest`.
- [ ] T009 [US1] Bump AI clients in `package.json`: `pnpm add @ai-sdk/openai@latest ai@latest openai@latest`.
- [ ] T010 [US1] Bump `@tabler/icons-react` 3.37.1 → 3.41.1 via `pnpm add @tabler/icons-react@latest`.
- [ ] T011 [US1] Bump TanStack pair in `package.json`: `pnpm add -D @tanstack/react-router@latest @tanstack/react-start@latest`.
- [ ] T012 [US1] Bump Cloudflare/Vite plumbing in `package.json`: `pnpm add -D @cloudflare/vite-plugin@latest wrangler@latest` (wrangler must precede Vite 8 — see plan Phase A).
- [ ] T013 [US1] Bump libsql + drizzle in `package.json`: `pnpm add @libsql/client@latest drizzle-orm@latest && pnpm add -D drizzle-kit@latest`.
- [ ] T014 [US1] Bump lint-staged 16.2.7 → 16.4.0 via `pnpm add -D lint-staged@latest`.
- [ ] T015 [US1] Bump `@aws-sdk/client-s3` 3.999.0 → 3.1037.0 via `pnpm add @aws-sdk/client-s3@latest`. Verify imports `S3Client`, `PutObjectCommand`, `DeleteObjectCommand` in `instances/s3.ts` and `services/cloudflare.ts` still type-check.
- [ ] T016 [US1] Run gate after Phase A: `pnpm install --frozen-lockfile && pnpm cf-typegen && pnpm lint && pnpm test:coverage && pnpm build`. All must exit zero.
- [ ] T017 [US1] Commit Phase A: `git add package.json pnpm-lock.yaml && git commit -m "chore(deps): bump minor/patch dependencies"`.

### Phase B — TypeScript 5 → 6

- [ ] T018 [US1] Bump TypeScript: `pnpm add -D typescript@latest`. Run `pnpm exec tsc --noEmit`.
- [ ] T019 [US1] Fix any new TS 6 errors surfaced by step T018 in production code (under `app/`, `components/`, `services/`, `utils/`, `hooks/`, `env/`, `start/`, `db/`). DO NOT loosen `tsconfig.json`. If a fix requires non-trivial refactor, drop the bump (see Drop & report below).
- [ ] T020 [US1] Run gate after Phase B: `pnpm install --frozen-lockfile && pnpm cf-typegen && pnpm lint && pnpm test:coverage && pnpm build`. Record post-bump test count + coverage % in the commit body for evidence against the baseline captured in T002.
- [ ] T021 [US1] Commit Phase B: `git commit -am "chore(deps): bump typescript to 6"`.

### Phase C — Vite 7 → 8 + plugin-react 5 → 6

- [ ] T022 [US1] Bump Vite + plugin-react together: `pnpm add -D vite@latest @vitejs/plugin-react@latest`.
- [ ] T023 [US1] Tighten `package.json#engines.node` from `"22.x"` to `">=22.12"`.
- [ ] T024 [US1] Verify `vite.config.mts` still loads `cloudflare()` + `tanstackStart()` + `react()` plugins under Vite 8. Tweak only if Vite 8 rejects existing usage.
- [ ] T025 [US1] Verify `vitest.config.ts` still loads `@vitejs/plugin-react@6` under Vitest 4. Tweak only if needed.
- [ ] T026 [US1] Run gate after Phase C: `pnpm install --frozen-lockfile && pnpm cf-typegen && pnpm lint && pnpm test:coverage && pnpm build`. All must exit zero.
- [ ] T027 [US1] Commit Phase C: `git commit -am "chore(deps): bump vite to 8 + plugin-react to 6"`.

### Drop & report (applies to any phase above)

- [ ] T028 [US1] If any single bump in Phases A/B/C cannot be made green after a reasonable fix attempt, revert that single package via `pnpm add <pkg>@<previous>` (or revert the offending line in `package.json` + re-run `pnpm install`), record the package + target version + reason in a working notes file `specs/003-deps-upgrade/skipped.md` (gitignored — used only as PR-body source).

**Checkpoint**: Local `pnpm preview` smoke (home, `/explore`, `/new`, `/[id]`, `/[id]/edit`) renders without console errors.

---

## Phase 4: User Story 2 — Skipped Upgrades Are Auditable (Priority: P2)

**Goal**: PR description always contains a `## Skipped upgrades` section.

**Independent Test**: PR body view includes the section. If empty, contains literal "(none)".

- [ ] T029 [US2] Push branch: `git push -u origin 003-deps-upgrade`.
- [ ] T030 [US2] Compose PR body with `## Summary`, `## Skipped upgrades` (sourced from `specs/003-deps-upgrade/skipped.md` if it exists; otherwise "(none)"), and `## Test plan`. Use HEREDOC pattern.
- [ ] T031 [US2] Open PR: `gh pr create --base main --title "chore(deps): bump everything to latest (TS 6, Vite 8, plugin-react 6)" --body "<assembled body>"`. Capture the PR URL.

**Checkpoint**: PR URL captured. Stored in working notes for US3.

---

## Phase 5: User Story 3 — `/gh-pr-no-checkout-review` Reports Zero P0/P1/P2 (Priority: P3)

**Goal**: Independent zero-context review subagent confirms no P0/P1/P2 findings.

**Independent Test**: Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh agent session. Output: zero P0, zero P1, zero P2 findings (P3 noise tolerated).

- [ ] T032 [US3] Spawn zero-context Opus subagent via Agent tool with subagent_type=general-purpose. Pass the PR URL and the explicit instruction to invoke `/gh-pr-no-checkout-review` and report findings keyed by severity. Subagent has NO conversation context.
- [ ] T033 [US3] Triage subagent findings. Drop P3. For each P0/P1/P2 item, file the affected file path + line number + recommended fix into a working notes file.
- [ ] T034 [US3] If P0/P1/P2 list is empty, mark T035 done and exit US3 loop.
- [ ] T035 [US3] Otherwise, fix all flagged items in production code or config. Run `pnpm lint && pnpm test:coverage && pnpm build` to keep gates green. Push fixes to `003-deps-upgrade`.
- [ ] T036 [US3] Re-run T032. Iterate the loop. Maximum 3 iterations per spec FR-010.

**Checkpoint**: Subagent report contains zero P0/P1/P2 findings.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T037 Verify CI on the PR is green (both `lint` and `test` jobs in `.github/workflows/lint.yml`).
- [ ] T038 Confirm `pnpm outdated` reports zero rows (or only documented skips) — paste into PR body comment.
- [ ] T039 Final sanity: `pnpm install --frozen-lockfile && pnpm cf-typegen && pnpm lint && pnpm test:coverage && pnpm build` on a fresh clone.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately.
- **Foundational (Phase 2)**: depends on Setup.
- **User Story 1 (Phase 3)**: depends on Foundational. Phases A → B → C strictly ordered.
- **User Story 2 (Phase 4)**: depends on US1 complete (otherwise no PR body to compose).
- **User Story 3 (Phase 5)**: depends on US2 complete (needs PR URL).
- **Polish (Phase 6)**: depends on US3 clean review.

### Within US1

- Phase A → Phase B → Phase C strict ordering.
- Within Phase A, T005 through T015 must serialise (single `package.json` + lockfile).
- T016 (gate) blocks T017 (commit).
- Drop & report (T028) is invoked from any failure point.

### Parallel Opportunities

- Almost none in this feature: every package bump touches `package.json` + `pnpm-lock.yaml`. Forcing parallel agents on these files would conflict at every commit. Sequential execution is the lowest-friction path.
- **Exception**: T024 + T025 (Vite/Vitest config inspection in Phase C) touch different files; can be reviewed in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001–T004 — verify baseline.
2. T005–T027 — Phases A/B/C strictly ordered.
3. **STOP and VALIDATE**: gate green; preview smoke clean. Local copy is shippable.

### Add audit trail (US2)

4. T029–T031 — push, compose, open PR. The presence of the `## Skipped upgrades` section is the deliverable.

### Backstop with review subagent (US3)

5. T032–T036 — iterate up to 3 times. Stop only when clean.
6. T037–T039 — confirm CI green and `pnpm outdated` empty.

---

## Notes

- No new tests. The existing ~270-test suite is the regression gate.
- `[P]` rarely applicable: package.json + pnpm-lock.yaml serialise commits.
- `Drop & report` (T028) is the safety valve — never block the PR on a single recalcitrant package.
- Conventional Commit prefix `chore(deps)` for every commit.
- Coverage thresholds in `vitest.config.ts` (50/50/50/50) MUST remain unchanged.
- After PR merges, no follow-up tasks anticipated.
