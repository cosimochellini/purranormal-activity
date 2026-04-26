---
description: "Task list for imagePipeline.run with discriminated PipelineOutcome"
---

# Tasks: `imagePipeline.run()` with Discriminated `PipelineOutcome`

**Input**: Design documents from `/specs/005-image-pipeline-outcome/`
**Prerequisites**: plan.md, spec.md.

**Tests**: New tests are authored alongside the new module
(`services/imagePipeline.test.ts`). Legacy tests for `services/content.ts`,
`services/trigger.ts`, and the `setLogError` block in
`services/log.test.ts` are deleted in Phase 5.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no shared dependency.
- **[Story]**: Maps task to user story (US1, US2, US3, US4).

## Path Conventions

Single-project layout. Repo root:
`/Users/cosimochellini/Documents/projects/purranormal-activity/`. Work
happens in worktree `.worktrees/005-image-pipeline-outcome/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create branch + worktree: `git worktree add -b 005-image-pipeline-outcome .worktrees/005-image-pipeline-outcome main`.
- [ ] T002 Verify deps: `pnpm install --frozen-lockfile` (no new deps required).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Author the new module and its boundary suite. Everything else
depends on these being importable.

- [ ] T003 [US1, US2, US3, US4] Add `services/imagePipeline.ts` with:
  - `PipelineOutcome` discriminated union (4 variants).
  - `PipelineDeps` interface (`loadStatus`, `generate`, `markGenerated`, `recordError`).
  - `ImagePipeline` interface (`run(logId)`).
  - `createImagePipeline(deps)` factory implementing the algorithm in plan.md.
  - Default deps wrappers around drizzle/AI/R2.
  - `createDefaultImagePipeline(overrides?)` and the `imagePipeline` singleton.
- [ ] T004 [US1, US2, US3, US4] Add `services/imagePipeline.test.ts` covering:
  - skipped:not-found
  - skipped:not-pending (parameterized over `ImageGenerated` and `Error`)
  - success
  - failed-recorded (generate throws)
  - failed-recorded (markGenerated throws)
  - failed-write-also-failed (generate + recordError both throw)
  - default-deps recordError writes `{ status: Error, error: <msg> }` in a single `db.update`
  - default-deps recordError serializes non-Error causes via JSON.stringify
  - default-deps surfaces failed-write-also-failed when the DB update throws

---

## Phase 3: Caller Migrations (one task per entry point)

- [ ] T005 [P] [US1] Migrate `start/routes/api/log/submit.ts`:
  - Replace `import { regenerateContents } from '@/services/content'` with `import { imagePipeline } from '@/services/imagePipeline'`.
  - Replace `await regenerateContents({ triggerLogId: newLog.id })` with `await imagePipeline.run(newLog.id)`.
- [ ] T006 [P] [US1] Migrate `start/routes/api/log/$id.ts`:
  - PUT: replace `regenerateContents({ triggerImages: …Created, triggerLogId: updated.id })` with `await imagePipeline.run(updated.id)` (pipeline's own status check skips non-pending rows).
  - DELETE: remove the no-op `await regenerateContents({ triggerImages: false })` line entirely.
  - Drop the `regenerateContents` import.
- [ ] T007 [P] [US1, US2] Rewrite `start/routes/api/trigger/$id.ts`:
  - Drop `setLogError` and `generateLogImage` imports; add `imagePipeline` import.
  - Compute `logId` once; reject NaN with the existing 'Invalid log id' shape.
  - Call `imagePipeline.run(logId)`; `switch` exhaustively on `outcome.kind`.
  - Preserve `X-Invalidate: log:<id>` on success and on both failed-* outcomes (the row was mutated so loaders need to revalidate). Do NOT emit it on `skipped:not-found`.
  - Log `failed-recorded` and `failed-write-also-failed` via `logger.error` with structured payload.
- [ ] T008 [P] [US1, US2] Rewrite `services/script.ts`:
  - Replace `import { generateLogImage } from '@/services/trigger'` with the `imagePipeline` import.
  - `processLog(logEntry)` calls `imagePipeline.run(logEntry.id)` and switches on `outcome.kind`.
  - On `failed-write-also-failed`, fan out a Telegram alert via `sendMessage` from `@/services/telegram` to every chat in `TELEGRAM_BOT_CHAT_IDS`. Per-chat send wrapped in try/catch (failure logged, not propagated).
  - On `skipped:*` and `failed-recorded`, log via `logger.warn`/`logger.error` and continue.

---

## Phase 4: API-Route Tests

- [ ] T009 [P] [US1] Update `tests/api/log.submit.test.ts`:
  - Replace `vi.mock('@/services/content', …)` with `vi.mock('@/services/imagePipeline', () => ({ imagePipeline: { run: vi.fn(async (id) => ({ kind: 'success', logId: id })) } }))`.
  - Replace `expect(regenerateContents).toHaveBeenCalledWith({ triggerLogId: 123 })` with `expect(imagePipeline.run).toHaveBeenCalledWith(123)`.
- [ ] T010 [P] [US1] Update `tests/api/log.$id.test.ts`:
  - Replace `vi.mock('@/services/content', …)` with the pipeline mock.
  - Replace `expect(regenerateContents).toHaveBeenCalledWith({ triggerImages: true, triggerLogId: 7 })` with `expect(imagePipeline.run).toHaveBeenCalledWith(7)`.
  - DELETE handler tests no longer need to verify regenerateContents (the call was removed).
- [ ] T011 [P] [US1, US2] Rewrite `tests/api/trigger.$id.test.ts`:
  - `vi.mock('@/services/imagePipeline', () => ({ imagePipeline: { run: vi.fn() } }))`.
  - Cover: invalid id (no service call, no X-Invalidate); success → `{success:true}` + X-Invalidate; failed-recorded → `{success:false,error:<msg>}` + X-Invalidate; skipped:not-found → no X-Invalidate; failed-write-also-failed → `{success:false,error:<msg>}` + X-Invalidate + logger.error called with cause+writeError.
- [ ] T012 [P] [US1, US2] Rewrite `services/script.test.ts`:
  - `vi.mock('@/services/imagePipeline', () => ({ imagePipeline: { run: vi.fn() } }))`.
  - `vi.mock('@/services/telegram', () => ({ sendMessage: vi.fn(async () => ({ success: true })) }))`.
  - Cover: zero pending rows; happy-path batch; mid-batch `failed-write-also-failed` triggers `sendMessage` for every configured chat; mid-batch `failed-recorded` does NOT trigger Telegram; initial DB select throw returns the error response.

---

## Phase 5: Cleanup (Removal)

- [ ] T013 [P] [US1] Delete `services/content.ts`.
- [ ] T014 [P] [US1] Delete `services/content.test.ts`.
- [ ] T015 [P] [US1] Delete `services/trigger.ts`.
- [ ] T016 [P] [US1] Delete `services/trigger.test.ts`.
- [ ] T017 [US2, US3] Strip `setLogError` from `services/log.ts`:
  - Remove the `export async function setLogError(...)` block.
  - Remove the now-unused `import { logger } from '../utils/logger'`.
- [ ] T018 [US2, US3] Strip `setLogError` tests from `services/log.test.ts`:
  - Remove the entire `describe('setLogError', …)` block.
  - Drop `setLogError` from the `import` statement.
  - Drop the `import { logger } from '@/utils/logger'` line if unused after the removal.

---

## Phase 6: Verification

- [ ] T019 `pnpm install --frozen-lockfile`
- [ ] T020 `pnpm lint` — zero diagnostics. If issues: `pnpm lint:fix` then re-run.
- [ ] T021 `pnpm typecheck` — clean compile under `tsconfig.build.json`.
- [ ] T022 `pnpm test` — full vitest suite green; coverage ≥ 50%.
- [ ] T023 `pnpm build` — `dist/` produced without errors.

---

## Phase 7: PR & Review Loop

- [ ] T024 Stage and commit on branch `005-image-pipeline-outcome` with a single commit message ending `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- [ ] T025 Push branch with `git push -u origin 005-image-pipeline-outcome`.
- [ ] T026 Open PR via `gh pr create` with a structured body listing the 4 outcome variants and the 4 entry-point migrations.
- [ ] T027 Spawn a fresh **opus** subagent with zero context invoking `/gh-pr-no-checkout-review` against the PR URL.
- [ ] T028 If the review reports any P0/P1/P2: fix in worktree → re-run T020–T023 → commit → push → spawn a brand-new opus subagent (never reuse) → repeat. Loop terminates only when one review pass returns zero P0/P1/P2.

---

## Dependency Graph

- T002 → T003
- T003 → T004, T005, T006, T007, T008 (caller migrations need the new module to exist)
- T005 → T009
- T006 → T010
- T007 → T011
- T008 → T012
- T009, T010, T011, T012 → T013…T018 (cleanup happens after migrations are tested)
- T013…T018 → T019…T023 (verification gates)
- T019…T023 → T024 (commit only when green)
- T024 → T025 → T026 → T027 → T028 (review loop)
