---
description: "Task list for project hardening — Vitest suite + 16 bug fixes"
---

# Tasks: Project Hardening — Test Suite & Bug Fixes

**Input**: Design documents from `/specs/001-project-hardening-tests/`
**Prerequisites**: plan.md, spec.md (both present and validated)

**Tests**: Required by feature spec (User Story 1 mandates regression tests).

**Organization**: Tasks grouped by user story (US1 = bug fixes + regressions; US2 = CI gate; US3 = pure-code coverage). Phase 1 (Setup) and Phase 2 (Foundational) MUST land first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelisable (different files, no dependency)
- **[Story]**: US1 / US2 / US3

## Path Conventions

- Co-located tests: `<dir>/<file>.test.ts(x)` for `utils/`, `services/`, `hooks/`, `env/`.
- Centralised tests: `tests/components/**` and `tests/api/**`.
- Shared test infra: `vitest.config.ts`, `test-setup.ts`, `tests/helpers.ts` at repo root.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Add devDeps `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom` via `pnpm add -D` in `package.json`.
- [ ] T002 Add `test`, `test:watch`, `test:coverage` scripts to `package.json`.
- [ ] T003 Create `vitest.config.ts` per plan.md.
- [ ] T004 Create `test-setup.ts` per plan.md (jest-dom matchers + global fetch stub + nuqs adapter mock + logger mock + `afterEach(vi.resetAllMocks)`).
- [ ] T005 Create `tests/helpers.ts` exporting `makeFakeDb`, `mockFetchSequence`, `mockOpenAIClient`, `mockS3Client`.

**Checkpoint**: Vitest infra runs with zero tests (`pnpm test:coverage` exits with threshold failure but config is valid).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T010 [US1] Bug #15 fix — export `__resetCategoryCache` from `services/categories.ts`.
- [ ] T011 [US1] Bug #14 fix — rename `hooks/useExporeData.ts` → `hooks/useExploreData.ts` and update every consumer import (search repo for `useExporeData`).
- [ ] T012 [US1] Bug #1 fix — `env/telegram.ts`: defensive read with `getRequiredEnv`-or-default fallback + warn via `utils/logger`.

**Checkpoint**: Production code compiles; foundations for bug-fix story unblocked.

---

## Phase 3: User Story 1 — Bug Fixes + Regression Tests (P1) 🎯 MVP

**Goal**: Each of the 16 bugs is fixed and locked behind a regression test.

### Tests (write FIRST, then fix; or red→green per bug)

#### Agent A — utils/services pure + service mocked

- [ ] T100 [P] [US1] `utils/array.test.ts` — `distinctBy`, `range` (incl. SC-005 ≥95%).
- [ ] T101 [P] [US1] `utils/batch.test.ts` — `batch(items, size)` edges (empty, size=0, size>length).
- [ ] T102 [P] [US1] `utils/time.test.ts` — every unit conversion arm.
- [ ] T103 [P] [US1] `utils/typed.test.ts` — typedObjectEntries/Keys/Values.
- [ ] T104 [P] [US1] `utils/promise.test.ts` — `wait` with fake timers.
- [ ] T105 [P] [US1] `utils/random.test.ts` — `randomItem` with seeded `Math.random` stub.
- [ ] T106 [P] [US1] `utils/http.test.ts` — every response builder.
- [ ] T107 [P] [US1] `utils/public-image.test.ts` — `publicImage` with env stub.
- [ ] T108 [P] [US1] `utils/viewTransition.test.ts` — `transitions` factory.
- [ ] T109 [P] [US1] `utils/image.test.ts` — `toAssetSrc` pure + `downloadImageAsBuffer` with fetch mock.
- [ ] T110 [P] [US1] `utils/fetch.test.ts` — `fetcher` with method/body/query mocks.
- [ ] T111 [P] [US1] `utils/cloudflare.test.ts` — `uploadToCloudflareImages`, `uploadToR2`, `deleteFromR2` with S3 + fetch mocks.
- [ ] T112 [P] [US1] `services/prompts.test.ts` — snapshot every template (SC-005 100%).
- [ ] T113 [P] [US1] `services/log.test.ts` — `addCategories`, `getLogs/getLog` with fake db; **regression for Bug #16** (setLogError logs error with stack).
- [ ] T114 [P] [US1] `services/categories.test.ts` — cache reset proves Bug #15 fix.
- [ ] T115 [P] [US1] `services/ai.test.ts` — `removeHTMLTags` pure + OpenAI-mocked branches.
- [ ] T116 [P] [US1] `services/notification.test.ts` — **regression for Bug #2** (returns `photoResult.error`, not `result.error`).
- [ ] T117 [US1] Bug #2 fix — `services/notification.ts:43`.
- [ ] T118 [US1] Bug #16 fix — `services/log.ts:115` `setLogError` logs via `logger.error`.

#### Agent B — hooks + components

- [ ] T200 [P] [US1] `hooks/state.test.ts` — `usePartialState` merge.
- [ ] T201 [P] [US1] `hooks/useExploreData.test.ts` — URL state sync, throttle, enum parsing.
- [ ] T202 [P] [US1] `hooks/useInfiniteScroll.test.ts` — pagination + dedupe.
- [ ] T203 [P] [US1] `hooks/useSound.test.ts` — Audio stub, play/pause/stop.
- [ ] T210 [P] [US1] `tests/components/explore/ExploreResults.test.tsx` — **regression for Bugs #3 + #13**.
- [ ] T211 [P] [US1] `tests/components/newLog/initial.test.tsx` — **regression for Bug #6**.
- [ ] T212 [P] [US1] `tests/components/newLog/refinement.test.tsx` — **regression for Bug #7**.
- [ ] T213 [P] [US1] `tests/components/newLog/MissingCategoriesModal.test.tsx` — **regression for Bug #5**.
- [ ] T214 [P] [US1] `tests/components/editLog/index.test.tsx` — **regression for Bug #8**.
- [ ] T215 [P] [US1] `tests/components/events/EventImage.test.tsx` — **regression for Bug #10**.
- [ ] T216 [P] [US1] `tests/components/events/InfiniteEvents.test.tsx` — **regression for Bug #9**.
- [ ] T217 [P] [US1] `tests/components/image/TriggerImageGeneration.test.tsx` — **regression for Bug #4**.
- [ ] T218 [P] [US1] `tests/components/timer/refetch.test.tsx` — **regression for Bug #11**.
- [ ] T219 [P] [US1] `tests/components/common/Category.test.tsx`.
- [ ] T220 [P] [US1] `tests/components/inputs/RadioOption.test.tsx`.
- [ ] T221 [P] [US1] `tests/components/events/IntersectionTrigger.test.tsx`.
- [ ] T230 [US1] Bug #3 fix — `components/explore/ExploreResults.tsx`: useState + AbortController.
- [ ] T231 [US1] Bug #4 fix — `components/image/TriggerImageGeneration.tsx`: proper handlers/`.finally`.
- [ ] T232 [US1] Bug #5 fix — `components/newLog/MissingCategoriesModal.tsx`: check second response.
- [ ] T233 [US1] Bug #6 fix — `components/newLog/initial.tsx`: null-guard after `.catch`.
- [ ] T234 [US1] Bug #7 fix — `components/newLog/refinement.tsx`: reject empty `otherText`.
- [ ] T235 [US1] Bug #8 fix — `components/editLog/index.tsx`: unify `submitting` flags.
- [ ] T236 [US1] Bug #9 fix — `components/events/InfiniteEvents.tsx`: useEffect deps.
- [ ] T237 [US1] Bug #10 fix — `components/events/EventImage.tsx`: surface rejection.
- [ ] T238 [US1] Bug #11 fix — `components/timer/refetch.tsx`: replace `window.location.reload()` with `router.invalidate()`.
- [ ] T239 [US1] Bug #13 fix — `components/explore/ExploreResults.tsx`: `console.error` → `logger.error`.

#### Agent C — env + API routes + service orchestration

- [ ] T300 [P] [US1] `env/telegram.test.ts` — **regression for Bug #1** (no throw on undefined).
- [ ] T310 [P] [US1] `tests/api/log.test.ts` — POST schema + happy/sad paths.
- [ ] T311 [P] [US1] `tests/api/log.$id.test.ts` — GET/PUT/DELETE branches.
- [ ] T312 [P] [US1] `tests/api/log.$id.categories.test.ts`.
- [ ] T313 [P] [US1] `tests/api/log.all.test.ts` — pagination + filters.
- [ ] T314 [P] [US1] `tests/api/log.refine.test.ts` — AI-mocked refinement.
- [ ] T315 [P] [US1] `tests/api/log.submit.test.ts` — **regression for Bug #12** (treeifyError null branch).
- [ ] T316 [P] [US1] `tests/api/categories.test.ts`.
- [ ] T317 [P] [US1] `tests/api/script.test.ts`.
- [ ] T318 [P] [US1] `tests/api/telegram.$id.test.ts`.
- [ ] T319 [P] [US1] `tests/api/trigger.$id.test.ts`.
- [ ] T320 [P] [US1] `tests/api/upload.$id.test.ts`.
- [ ] T321 [P] [US1] `services/script.test.ts`.
- [ ] T322 [P] [US1] `services/trigger.test.ts`.
- [ ] T323 [P] [US1] `services/content.test.ts`.
- [ ] T330 [US1] Bug #12 fix — `start/routes/api/log/submit.ts:45` guard `z.treeifyError().errors`.

**Checkpoint**: All 16 bugs fixed; every fix has a passing regression test.

---

## Phase 4: User Story 2 — CI Coverage Gate (P2)

- [ ] T400 [US2] Edit `.github/workflows/lint.yml`: add `test` job per plan.md.
- [ ] T401 [US2] Confirm `vitest.config.ts` thresholds (50/50/50/50) trigger non-zero exit when intentionally broken (smoke test by lowering one threshold and reverting).

**Checkpoint**: A coverage drop below 50% in either lines or branches blocks merge in CI.

---

## Phase 5: User Story 3 — Pure-Code Exhaustive Coverage (P3)

- [ ] T500 [US3] Verify SC-005 — pure utility files and `services/prompts.ts` each report ≥95% line coverage. Top up any gap.

**Checkpoint**: Pure code is exhaustively tested.

---

## Phase 6: Polish & Verify

- [ ] T600 Run `pnpm install --frozen-lockfile`.
- [ ] T601 Run `pnpm cf-typegen` and verify no new diff (commit if there is).
- [ ] T602 Run `pnpm lint`. Must be clean.
- [ ] T603 Run `pnpm build`. Must succeed.
- [ ] T604 Run `pnpm test:coverage`. Must report ≥50% lines AND ≥50% branches.
- [ ] T605 Commit (Conventional Commits per logical group).
- [ ] T606 Push `001-project-hardening-tests`.
- [ ] T607 Open PR via `gh pr create --base main`.

---

## Phase 7: Review Iteration (≤ 3 rounds)

- [ ] T700 Run `/gh-pr-no-checkout-review <PR-URL>` with subagent_type `general-purpose` (zero context).
- [ ] T701 Triage findings: P0 (regressions), P1 (real bugs), P2 (test/structural issues). Ignore P3.
- [ ] T702 If non-empty: spawn 3 opus agents (A/B/C, only flagged files) to fix; each must keep `pnpm lint && pnpm test:coverage` green.
- [ ] T703 Push and re-review. Repeat ≤ 3 iterations total.

---

## Dependencies & Execution Order

- Phase 1 (Setup) MUST land before any test runs.
- Phase 2 (Foundational T010–T012) MUST land before Agent B's hook/component tests (rename + cache reset + env fix).
- Phase 3 user-story tasks within an agent are mostly `[P]` (different files); fix tasks (T117/T118, T230–T239, T330) MUST land after their corresponding test tasks (or alongside, in red→green order).
- Phase 4 (CI gate) lands after Phase 3 (so CI run sees real coverage).
- Phase 6 (Verify) gates Phase 7 (Review).

## Parallel Example: Agent A first wave

```bash
T100 utils/array.test.ts      &   # [P]
T101 utils/batch.test.ts      &   # [P]
T102 utils/time.test.ts       &   # [P]
T106 utils/http.test.ts       &   # [P]
T112 services/prompts.test.ts &   # [P]
wait
```

## Notes

- [P] tasks = different files, no dependencies.
- Conventional Commits per logical group: `test(utils): add array/batch/...`, `fix(notification): return photoResult.error`, etc.
- Spec-kit's `after_*` hooks auto-commit at boundaries when enabled.
- No husky changes per FR-013.
