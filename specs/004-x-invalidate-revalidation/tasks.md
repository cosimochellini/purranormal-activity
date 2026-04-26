---
description: "Task list for 004-x-invalidate-revalidation"
---

# Tasks: Delete cache no-op, ship `X-Invalidate` revalidation

**Input**: Design documents from `/specs/004-x-invalidate-revalidation/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories)

**Tests**: REQUIRED — Constitution §I (Test-First Pragmatism) demands co-located tests for new utils and route-level boundary tests for handlers. Coverage threshold ≥50% lines AND ≥50% branches MUST stay green.

**Organization**: Tasks are grouped by phase (Foundation → user stories → cleanup). Each phase has a checkpoint. `[P]` marks tasks that touch disjoint files and may be run in parallel.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: Different files, no dependency on other tasks in the same phase.
- `[Story]`: Maps to a user story in spec.md (US1 / US2 / US3 / US4 / US5).
- File paths are relative to the worktree root.

---

## Phase 1: Setup

**Purpose**: One-shot worktree + branch hygiene. No code changes.

- [ ] **T001** Confirm worktree at `.worktrees/004-x-invalidate` is on branch `004-x-invalidate-revalidation` and clean (`git status` empty).
- [ ] **T002** Confirm baseline `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is fully green BEFORE any change.

**Checkpoint**: Clean tree, all gates green.

---

## Phase 2: Foundational (Blocks Every User Story)

**Purpose**: Build the type, predicate, header contract, router accessor, fetcher interceptor.

**⚠️ CRITICAL**: No user story work begins until Phase 2 is complete and tested.

- [ ] **T003** [P] Create `utils/invalidation.ts` exporting `InvalidationTag` (`'logs' | \`log:${number}\``) and `matchesTags(match, tags): boolean`. Use a structural-fallback type if `AnyRouteMatch` import fails typecheck. **Logs**: routeId `/` or `/explore`. **`log:N`**: routeId `/$id/` or `/$id/edit` AND `params.id === N`. Unknown tags return false.
- [ ] **T004** [P] Create `utils/invalidation.test.ts`: truth-table coverage (positive + negative). Cases: `logs` matches `/` and `/explore`; `logs` does NOT match `/$id/`; `log:7` matches `/$id/` only with `params.id === '7'`; `log:7` matches `/$id/edit` similarly; mixed-tag union (`['logs', 'log:7']`); empty array returns false; unknown tag string returns false. Constitution §II: pure functions, no mocks.
- [ ] **T005** [US1, US2, US4] Modify `utils/http.ts`: change `ok<T>(body)` to `ok<T>(body, init?: { invalidate?: readonly InvalidationTag[] })`. Emit `X-Invalidate` header only when `invalidate?.length` is truthy. Always emit `Content-Type: application/json`. Other helpers untouched.
- [ ] **T006** [P] Create `utils/http.test.ts`: positive (`{ invalidate: ['logs'] }` → header `'logs'`; `['logs', 'log:7']` → `'logs,log:7'`; default Content-Type set), negative (omitted / empty array → no header). Use `res.headers.get('X-Invalidate')`.
- [ ] **T007** [US3] Modify `start/router.tsx`: add module-scope `let activeRouter: AnyRouter | undefined`; set inside `getRouter()` only when `typeof window !== 'undefined'`; export `getActiveRouter()`.
- [ ] **T008** Modify `utils/fetch.ts`: after a successful `fetch()` resolves with `r.ok === true`, read `X-Invalidate` from `r.headers`, parse to `InvalidationTag[]`, call `getActiveRouter()?.invalidate({ filter: m => matchesTags(m, tags) })`. On `router.invalidate` rejection, log via `logger.error`. Skip silently when no router or no header. Run BEFORE returning the `r.json()` promise so the loader has time to start refetching but does not block the caller (i.e. `await applyInvalidation(r)` then return `r.json() as Promise<TResult>`).
- [ ] **T009** [P] Create `utils/fetch.test.ts`: mock `getActiveRouter` and `matchesTags` via `vi.hoisted`; mock global `fetch` to return `Response` with/without `X-Invalidate`. Cases: header present → `invalidate` called once with the parsed tags via filter; header absent → not called; router undefined → not called and no throw; multi-tag header round-trips.
- [ ] **T010** Run `pnpm lint && pnpm typecheck && pnpm test`. Must be green.

**Checkpoint**: Foundation ready. Mutation routes can now opt in via `ok(body, { invalidate })`.

---

## Phase 3: User Story 1 — Submit a log and immediately see it (P1) 🎯 MVP

**Goal**: A new log appears in the list without manual refresh.

**Independent Test**: POST `/api/log/submit` returns response with `X-Invalidate: logs,log:N`; Home loader refetches when fetcher invalidates.

### Implementation

- [ ] **T011** [US1] Modify `start/routes/api/log/submit.ts`: on success, return `ok<LogSubmitResponse>({ ... }, { invalidate: ['logs', \`log:${newLog.id}\`] })`. Do NOT add the header to validation-failure responses.
- [ ] **T012** [P] [US1] Modify `tests/api/log.submit.test.ts`: assert `res.headers.get('X-Invalidate')` equals `'logs,log:<id>'` on a happy-path submit; assert NO header on validation-failure paths.

**Checkpoint**: US1 fully testable. Test passes; gate still ≥50/50.

---

## Phase 4: User Story 2 — Edit a log and see updated fields (P1)

**Goal**: PUT/DELETE `/api/log/$id` invalidate both the list and the detail.

**Independent Test**: route-level header assertions; manual smoke on `/$id/edit`.

### Implementation

- [ ] **T013** [US2] Modify `start/routes/api/log/$id.ts` (PUT handler): on success, return `ok<LogIdPutResponse>({ ... }, { invalidate: ['logs', \`log:${id}\`] })`.
- [ ] **T014** [US2] Modify `start/routes/api/log/$id.ts` (DELETE handler): on success, return `ok<LogIdDeleteResponse>({ success: true }, { invalidate: ['logs', \`log:${id}\`] })`.
- [ ] **T015** [P] [US2] Modify `tests/api/log.$id.test.ts`: PUT happy-path → header `'logs,log:<id>'`; DELETE happy-path → same; failures (validation, missing log) → no header.
- [ ] **T016** [P] [US2] Modify `start/routes/api/log.ts` (legacy POST): on success, return `ok<LogPostResponse>({ success: true }, { invalidate: ['logs'] })`.
- [ ] **T017** [P] [US2] Modify `tests/api/log.test.ts`: assert header `'logs'` on success; not on validation failure.
- [ ] **T018** [P] [US2] Modify `start/routes/api/log/$id/categories.ts` POST: success → `{ invalidate: ['logs', \`log:${logId}\`] }`.
- [ ] **T019** [P] [US2] Modify `tests/api/log.$id.categories.test.ts`: assert header on success; not on failure.

**Checkpoint**: All log-CRUD mutations carry tags. Constitution gates green.

---

## Phase 5: User Story 3 — Image generation completes without polling (P1)

**Goal**: Drop `<Refetch>` polling; rely on `X-Invalidate: log:N` from `/api/trigger/$id` to drive a one-shot loader revalidation.

**Independent Test**: Mount `TriggerImageGeneration` with mocked fetcher; assert `<Refetch>` not rendered.

### Implementation

- [ ] **T020** [US3] Modify `start/routes/api/trigger/$id.ts`: success → `ok({ success: true }, { invalidate: [\`log:${logId}\`] })`. Caught-error branch (where `setLogError` ran) → `ok({ success: false, error: ... }, { invalidate: [\`log:${logId}\`] })`. Invalid-id branch → no header. Drop the `import { invalidatePublicContent }` and the call.
- [ ] **T021** [US3] Modify `tests/api/trigger.$id.test.ts`: drop the `vi.mock('@/services/content', …)` and the 2 `expect(invalidatePublicContent)…` assertions. Add new assertions: success → header `'log:7'`; thrown-error path (which still returns `ok`) → header `'log:7'`; invalid-id path → no header.
- [ ] **T022** [US3] Modify `components/image/TriggerImageGeneration.tsx`: remove `useState(shouldRefetch)`, remove `<Refetch>` import + usage. After `triggerGeneration` resolves the component returns `null` (no JSX side-effect). The fetcher interceptor handles loader invalidation.
- [ ] **T023** [P] [US3] Modify `tests/components/image/TriggerImageGeneration.test.tsx`: assert `<Refetch>` is no longer rendered (regression guard); assert `triggerGeneration` is still called once on mount; assert no errors logged.
- [ ] **T024** [US3] Delete `components/timer/refetch.tsx`.
- [ ] **T025** [US3] Delete `tests/components/timer/refetch.test.tsx`.
- [ ] **T026** [US3] Run `pnpm lint && pnpm typecheck && pnpm test`. All green; refetch tests gone, all others pass.

**Checkpoint**: No polling left in the codebase. `rg "<Refetch"` returns zero hits.

---

## Phase 6: User Story 4 — Delete a log and see it removed (P2)

Already covered by T014 + T015 (DELETE handler + test). No additional task.

---

## Phase 7: User Story 5 — Codebase honesty (P2)

**Goal**: Remove `invalidatePublicContent` and every reference.

### Implementation

- [ ] **T027** [US5] Modify `services/content.ts`: delete the `invalidatePublicContent` function (lines 6-9 of pre-change file) and the `await invalidatePublicContent()` line inside `regenerateContents`. Keep `regenerateContents` and the rest.
- [ ] **T028** [US5] Modify `services/script.ts`: delete the `import { invalidatePublicContent } from '@/services/content'` line and the `if (logs.length > 0) await invalidatePublicContent()` block.
- [ ] **T029** [US5] Modify `services/content.test.ts`: delete the `describe('invalidatePublicContent', ...)` block (lines 18-22 of pre-change file). Keep all other tests.
- [ ] **T030** [US5] Modify `services/script.test.ts`: delete the `vi.mock('@/services/content', ...)` block, the `import { invalidatePublicContent } from '@/services/content'` line, and the 3 `expect(invalidatePublicContent)…` assertions. Replace those assertions with the *absence* assertion only when needed (most can simply be deleted).
- [ ] **T031** [US5] Run `rg invalidatePublicContent` — must return zero hits in the worktree.

**Checkpoint**: Zero references. `pnpm test` still ≥272 tests.

---

## Phase 8: Polish & Verification

- [ ] **T032** Run `pnpm lint` — zero errors.
- [ ] **T033** Run `pnpm typecheck` — clean.
- [ ] **T034** Run `pnpm test:coverage` — green; ≥50% lines AND ≥50% branches.
- [ ] **T035** Run `pnpm build` — Vite production build succeeds.
- [ ] **T036** Run `pnpm cf-typegen` — no diff to `worker-configuration.d.ts`.
- [ ] **T037** `pnpm dev` smoke test per spec.md US1/US2/US3/US4 acceptance scenarios.
- [ ] **T038** Commit each phase as its own commit if not already done; ensure messages follow Conventional Commits.
- [ ] **T039** Push branch; open PR linking issue #8; PR body lists Part A / Part B and the known infinite-scroll limitation.
- [ ] **T040** Run `/gh-pr-no-checkout-review <PR-URL>` via a fresh-context Opus subagent. If P0/P1/P2 findings: fix, push, re-run. Repeat until 3 consecutive runs report zero P0/P1/P2.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no deps.
- **Phase 2 (Foundational)**: depends on Phase 1; **blocks Phases 3-7**.
- **Phases 3-6 (User stories)**: depend on Phase 2. Can proceed in priority order (P1 before P2).
- **Phase 7 (cleanup)**: depends on Phases 3-6 being green so we don't strand the no-op while routes still rely on tags. Independent in code, but easier to verify last.
- **Phase 8 (Polish)**: depends on all earlier phases.

### Parallel Opportunities

- T003, T004 (invalidation module + its test) can run in parallel with T005, T006 (http change + test) within Phase 2.
- Within Phase 4: T013-T019 touch different routes; can be parallelized after foundation lands.
- T029 / T030 (deleting test mocks) are different files → `[P]`.

---

## Notes

- **Constitution gates** must hold green between phases. If a phase intermediate state breaks lint/typecheck/test, fix forward; do NOT bypass `--no-verify` (Constitution §V).
- **No new dependencies** are added by this feature.
- **Conventional Commit** prefix per phase: `feat:` for Phases 2-5, `refactor:` for Phase 7, `chore:` for cleanup of test files.
- **Coverage**: deleting tests for a deleted no-op is acceptable; we add at least 5 new test files, raising the count.
- **Review loop**: zero P0/P1/P2 findings on three consecutive `/gh-pr-no-checkout-review` runs is the merge gate.
