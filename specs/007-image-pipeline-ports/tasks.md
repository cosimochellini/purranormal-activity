---
description: "Tasks for Image Pipeline Behind Ports & Adapters (007)"
---

# Tasks: Image Pipeline Behind Ports & Adapters

**Input**: Design documents from `/specs/007-image-pipeline-ports/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ports.md, quickstart.md

**Tests**: Required by FR-013, FR-014, FR-015, FR-016, SC-002, SC-003, SC-004 — boundary tests are core to this refactor; included.

**Organization**: Phases 1–2 set up the new module shell and migrate the current `run()` behaviour. Phases 3–5 map to user stories US1, US2, US3 (all P1). Phase 6 is the route-decoupling sweep (US4, P2). Phase 7 is boundary-test consolidation (US5, P2). Phase 8 is polish + verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, parallelizable.
- **[Story]**: US1–US5 trace back to spec.md user stories.

## Path conventions

Web service / TanStack Start. Source under `services/`, `start/routes/api/`, `tests/`.

---

## Phase 1: Setup (Module shell)

**Purpose**: Create the new directory layout and move `PipelineOutcome` + helpers into their new home without breaking callers.

- [X] T001 [P] Create empty directory `services/imagePipeline/adapters/`.
- [X] T002 [P] Create empty directory `tests/fakes/`.
- [X] T003 Move `PipelineOutcome`, `NO_FAILURE` sentinel, `causeToErrorString`, and `logPipelineOutcome` from `services/imagePipeline.ts` into a new file `services/imagePipeline/outcome.ts`. The old file temporarily re-exports them so callers stay green during the migration.

---

## Phase 2: Foundational (Ports + adapters + repository contract)

**Purpose**: Land the four port interfaces and their production adapters with feature parity to the current `defaultGenerate` / `defaultLoadStatus` / `defaultMarkGenerated` / `defaultRecordError`. After this phase, the new pipeline module exposes a working `generateImageFor(logId)` that is byte-equivalent to the current `imagePipeline.run(logId)`. **Blocks all user-story phases below.**

- [X] T004 Define port interfaces in `services/imagePipeline/ports.ts`: `AiTextPort`, `AiImagePort`, `ImageStorePort`, `LogRepositoryPort`, `DraftLog`, `LogRow`, `SubmitInput`, `SubmitResult`, `PipelineDeps`, `ImagePipeline`. Re-export `PipelineOutcome` from `./outcome`. Use the contracts in `specs/007-image-pipeline-ports/contracts/ports.md` as the source of truth.
- [X] T005 [P] Implement `services/imagePipeline/adapters/aiText.ts`: thin wrapper over `storyForge.imagePrompt(description)`, exporting `defaultAiText: AiTextPort`.
- [X] T006 [P] Implement `services/imagePipeline/adapters/aiImage.ts`: thin wrapper over `services/imageGen.ts::generateImageBase64`, exporting `defaultAiImage: AiImagePort`.
- [X] T007 [P] Implement `services/imagePipeline/adapters/imageStore.ts`: `defaultImageStore: ImageStorePort` with `put(logId, bytes, contentType)` calling `uploadToR2(Buffer.from(bytes), logId)` and `delete(logId)` calling `deleteFromR2(logId)`. Strip the `data:image/...;base64,` prefix here only if the caller forgets — pipeline core converts string→bytes before calling.
- [X] T008 [P] Implement `services/imagePipeline/adapters/logRepository.ts`: `defaultLogRepository: LogRepositoryPort` covering all seven methods. Use `db.transaction`-free Drizzle calls (Turso libsql/web has no `BEGIN`/`COMMIT` exposed). `findFirstPending` orders `id ASC LIMIT 1`. `markError` accepts a plain string (caller already ran `causeToErrorString`).
- [X] T009 Implement `services/imagePipeline/index.ts`: `createImagePipeline(deps)`, `createDefaultImagePipeline(overrides?)`, `pipeline` singleton, re-export `logPipelineOutcome` and `PipelineOutcome`. Implement `generateImageFor(logId)` first — preserving the `NO_FAILURE` sentinel ordering verbatim from `services/imagePipeline.ts:37-83`. `submit` and `drainOnePending` are method bodies that throw `new Error('not yet implemented')` until US1 / US3 land.
- [X] T010 Update the old `services/imagePipeline.ts` to re-export everything from `services/imagePipeline/index.ts` and add an alias `run = generateImageFor` so existing callers keep working without changes. Mark the file `@deprecated` in a JSDoc.
- [X] T011 Run `pnpm lint && pnpm test && pnpm build`. Must be green. Commit: `feat(007): scaffold imagePipeline module + ports + adapters`.

**Checkpoint**: Foundation ready. `imagePipeline.run(id)` still works through the new module. User stories can begin.

---

## Phase 3: User Story 1 — Submit end-to-end (Priority: P1)

**Goal**: `pipeline.submit(input)` inserts a draft, links categories, runs the image arc, returns `{ id, outcome }`.

**Independent Test**: With four in-memory adapters wired in, `submit` returns `{ kind: 'success' }` and the in-memory store contains one entry; with a throwing `aiImage`, returns `{ kind: 'failed-recorded' }` and the in-memory repo shows status `Error`; with a throwing `linkCategories`, the row exists with status `Error`.

### Tests for User Story 1 (boundary suite — write FIRST)

- [X] T012 [P] [US1] Add `tests/fakes/imagePipeline.ts`: `createInMemoryAiText`, `createInMemoryAiImage`, `createInMemoryImageStore`, `createInMemoryLogRepository`, `createTestPipeline({ overrides? })`. Each fake exposes `.snapshot()` for assertions and accepts `{ throws? }` configuration. No production-code imports.
- [X] T013 [P] [US1] Add boundary test cases to `services/imagePipeline/index.test.ts` for `submit`: success, `linkCategories` throws, `aiImage.generateBase64` throws, `aiImage` succeeds + `markImageGenerated` throws, double-failure (gen throws AND `markError` throws → `failed-write-also-failed`). NO `vi.mock('@/drizzle')`, `vi.mock('@/services/imageGen')`, `vi.mock('@/services/storyForge')`, `vi.mock('@/utils/cloudflare')`. Logger / env stubs only. Tests should fail until T014 lands.

### Implementation for User Story 1

- [X] T014 [US1] Implement `submit(input)` in `services/imagePipeline/index.ts`. Sequence: `repo.insertDraft(input.draft)` → `repo.linkCategories(id, input.categoryIds)` → run the same generate-and-mark arc as `generateImageFor(id)`. Wrap the link + arc in the existing failure handler so any throw goes through `recordError` → returns `failed-recorded` or `failed-write-also-failed`. `insertDraft` failure rejects to caller (no row to record against).
- [X] T015 [US1] Update `start/routes/api/log/submit.ts`: remove direct `db.insert(log)` + `db.insert(logCategory)` + `imagePipeline.run(newLog.id)`; replace with `pipeline.submit({ draft: { title, description, imageDescription }, categoryIds: filteredIds })`. Keep Zod validation, friendly-error mapping, and the `storyForge.logDetails` + `storyForge.categories` calls in the route. Use `logPipelineOutcome` on the result.

**Checkpoint**: US1 complete. `pnpm lint && pnpm test && pnpm build` green. The submit route no longer touches `db.insert`. Commit: `feat(007): pipeline.submit replaces submit-route db writes (US1)`.

---

## Phase 4: User Story 2 — generateImageFor for re-trigger / edit (Priority: P1)

**Goal**: PUT `/api/log/$id` and `POST /api/trigger/$id` call `pipeline.generateImageFor(id)` directly, no `run()` alias.

**Independent Test**: Both routes still produce their existing HTTP response shapes for all four outcome kinds.

### Tests for User Story 2

- [X] T016 [P] [US2] Extend `services/imagePipeline/index.test.ts` with `generateImageFor` boundary cases: success, status=ImageGenerated → `skipped/not-pending`, missing row → `skipped/not-found`, `loadStatus` throws → best-effort `markError` → `failed-recorded`, `markError` also throws → `failed-write-also-failed`. Confirm `aiText.imagePrompt` is NOT called when `imageDescription` is non-empty.

### Implementation for User Story 2

- [X] T017 [US2] Update `start/routes/api/log/$id.ts` PUT branch: replace `imagePipeline.run(id)` with `pipeline.generateImageFor(id)`. Keep `logPipelineOutcome(outcome, 'PUT /api/log/$id')`.
- [X] T018 [US2] Update `start/routes/api/trigger/$id.ts`: replace `imagePipeline.run(logId)` with `pipeline.generateImageFor(logId)`. Keep the exhaustive switch on `outcome.kind` for the response.
- [X] T019 [US2] Run `pnpm lint && pnpm test && pnpm build`. Commit: `feat(007): trigger + edit routes call pipeline.generateImageFor (US2)`.

**Checkpoint**: US2 complete. The `run()` alias from T010 is now unused.

---

## Phase 5: User Story 3 — drainOnePending sequential drain (Priority: P1)

**Goal**: `services/script.ts` runs a `while (await pipeline.drainOnePending()) …` loop. The 5-at-a-time `Promise.all` batch is gone.

**Independent Test**: With three Created rows in the in-memory repo, the script processes exactly three rows in three iterations, returns `{ success: true, processed: 3 }`. Re-run: `processed: 0`. Force one row to produce `failed-write-also-failed` → exactly one Telegram alert with HTML-escaped cause + writeError.

### Tests for User Story 3

- [X] T020 [P] [US3] Extend `services/imagePipeline/index.test.ts` with `drainOnePending` cases: empty queue → `null`; single Created row → wrapped success outcome; row pre-loaded as ImageGenerated → still picked up only if status==Created (otherwise findFirstPending wouldn't return it; cover both branches by injecting a fake repo where `findFirstPending` returns a stale id).
- [X] T021 [P] [US3] Rewrite `services/script.test.ts` to drive the new drain loop. Use a fake pipeline (object literal with `drainOnePending` queueing outcomes via `vi.fn`). Cover: N=0/1/3 rows, `failed-write-also-failed` triggers exactly one Telegram alert per chat id, `TELEGRAM_BOT_CHAT_IDS=[]` skips the alert, `drainOnePending` throws → outer catch returns `{ success: false, processed: 0, error: 'Failed to process logs' }`.

### Implementation for User Story 3

- [X] T022 [US3] Implement `drainOnePending()` in `services/imagePipeline/index.ts`: `const row = await deps.repo.findFirstPending(); if (!row) return null; return await this.generateImageFor(row.id);`.
- [X] T023 [US3] Rewrite `services/script.ts::runImageGenerationScript`. Sequential loop: `let processed = 0; while (true) { const outcome = await pipeline.drainOnePending(); if (!outcome) break; processed++; handle(outcome); } return { success: true, processed }`. Preserve `alertWriteAlsoFailed` (HTML-escape, per-chat-id, swallow individual errors). Drop `BATCH_SIZE`, `DELAY_MS`, `batch`, and `wait` imports.
- [X] T024 [US3] Run `pnpm lint && pnpm test && pnpm build`. Commit: `feat(007): drainOnePending replaces parallel batch in script.ts (US3)`.

**Checkpoint**: US3 complete. All three pipeline methods land. The old `run()` alias can be removed (Phase 6 cleanup).

---

## Phase 6: User Story 4 — Routes decoupled (Priority: P2)

**Goal**: Remove dead imports / aliases. Verify the grep contract from FR-012 / SC-001.

### Implementation for User Story 4

- [X] T025 [US4] Delete `services/imagePipeline.ts` (the old single-file shim). Update any remaining imports of `'@/services/imagePipeline'` to point at `'@/services/imagePipeline'` (directory index — same import path).
- [X] T026 [US4] Remove the `run` alias added in T010 from `services/imagePipeline/index.ts`. Confirm no callers reference `pipeline.run`.
- [X] T027 [US4] Run a grep contract test (manual): `grep -nE "from '@/services/imageGen'|from '@/utils/cloudflare'|db\\.insert\\(log\\)|db\\.update\\(log\\)" start/routes/api/log/submit.ts start/routes/api/log/\\$id.ts start/routes/api/trigger/\\$id.ts services/script.ts` MUST return zero matches. (`start/routes/api/log/$id.ts` DELETE branch may still call `deleteFromR2` directly — accepted; not pipeline-state related.)
- [X] T028 [US4] Run `pnpm lint && pnpm test && pnpm build`. Commit: `chore(007): drop legacy imagePipeline.ts + run() alias (US4)`.

**Checkpoint**: US4 complete. Routes are clean.

---

## Phase 7: User Story 5 — Boundary-test consolidation (Priority: P2)

**Goal**: Delete the legacy `services/imagePipeline.test.ts`; salvage any unique edge cases into the new boundary suite. Keep `services/imageGen.test.ts` and `services/script.test.ts`.

### Implementation for User Story 5

- [X] T029 [US5] Audit `services/imagePipeline.test.ts`. For each test case, confirm an equivalent exists in `services/imagePipeline/index.test.ts` (T013/T016/T020). Migrate any missing edge case (e.g., specific `causeToErrorString` AIError-discriminator persistence test).
- [X] T030 [US5] Delete `services/imagePipeline.test.ts` once parity is confirmed.
- [X] T031 [US5] Confirm the boundary suite passes the no-mock fingerprint (FR-014): grep for the four forbidden `vi.mock` strings inside `services/imagePipeline/index.test.ts`; expect zero matches.
- [X] T032 [US5] Run `pnpm lint && pnpm test:coverage && pnpm build`. Coverage threshold (50% lines + branches) must hold. Commit: `test(007): replace per-seam mocks with boundary suite (US5)`.

**Checkpoint**: US5 complete.

---

## Phase 8: Polish & verification

- [X] T033 [P] Update `services/imagePipeline/outcome.ts` JSDoc on `causeToErrorString` to call out FR-017 (unwrap rule). Touch nothing else.
- [X] T034 [P] Run the quickstart fingerprint checks from `specs/007-image-pipeline-ports/quickstart.md` sections 2 + 3. Capture output in the PR description.
- [X] T035 Run `pnpm cf-typegen`; confirm zero diff to `worker-configuration.d.ts` (Constitution gate 4).
- [X] T036 Final check: `pnpm lint && pnpm test:coverage && pnpm build` all green on the last commit.
- [X] T037 Open PR `gh pr create --base main --title "feat(007): image pipeline behind ports & adapters" …` (body links issue #6, lists ports + methods, checks SC-001..SC-006).
- [X] T038 Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh sub-agent. Iterate (Phase 9 below) until zero P0/P1/P2 findings.

---

## Phase 9: Review iteration loop (out-of-band)

- [X] T039 For each P0/P1/P2 finding from `/gh-pr-no-checkout-review`, dispatch a fresh Opus sub-agent (separate from the reviewer) to apply the patch + re-run `pnpm lint && pnpm test && pnpm build` + push.
- [X] T040 Re-run `/gh-pr-no-checkout-review` from a fresh reviewer sub-agent. Repeat T039–T040 (cap 5 iterations). If still failing after 5, flag to the user.
- [X] T041 Once SC-006 is met, `gh pr merge --squash --delete-branch`. Verify `main` builds locally.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup) → no deps. Files don't yet exist.
- Phase 2 (Foundational) → blocks Phases 3–7. Establishes ports, adapters, and the working `generateImageFor`.
- Phase 3 (US1) ↔ Phase 4 (US2) ↔ Phase 5 (US3) — all P1, independent, can run in parallel by separate developers/agents IF Phase 2 completes first. Each leaves the codebase green at its checkpoint.
- Phase 6 (US4) depends on Phase 4 + Phase 5 completing (so the old `run()` alias is dead before deletion).
- Phase 7 (US5) depends on Phase 5 completing (so all boundary cases exist before the legacy file is deleted).
- Phase 8 (Polish) depends on Phases 6 + 7. Phase 9 depends on Phase 8.

### Within Each User Story

- Tests written first (T013, T016, T020, T021) — must FAIL before the implementation tasks land.
- Implementation tasks proceed in order listed.
- Each phase ends with a green `pnpm lint && pnpm test && pnpm build` and a commit.

### Parallel Opportunities

- T001, T002 (Phase 1) — parallel.
- T005, T006, T007, T008 (Phase 2 adapters) — parallel; depend on T004 (ports) only.
- T012, T013 (Phase 3 tests) — parallel. T014 depends on T012/T013 existing.
- T020, T021 (Phase 5 tests) — parallel.
- T033, T034 (Phase 8) — parallel.

---

## Parallel example: Phase 2 adapters

```bash
# T005-T008 can be dispatched to four sub-agents simultaneously after T004 lands:
Agent A: services/imagePipeline/adapters/aiText.ts
Agent B: services/imagePipeline/adapters/aiImage.ts
Agent C: services/imagePipeline/adapters/imageStore.ts
Agent D: services/imagePipeline/adapters/logRepository.ts
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2 → working `generateImageFor` via new module, byte-equivalent to current `run`.
2. Phase 3 (US1) → submit moved into pipeline. Validate manually via `/api/log/submit` smoke (quickstart §4).
3. Phase 4 (US2) → trigger + edit migrated.
4. Phase 5 (US3) → drain loop in. /api/script smoke (quickstart §6).
5. Phases 6 + 7 → cleanup.
6. Phase 8 → final verification.
7. Phase 9 → review iteration to zero P0–P2.
8. Merge.

### Parallel agent strategy (per user request "open as many opus agents as needed")

- Phase 2 adapters T005–T008 dispatched to four parallel agents.
- Phases 3–5 dispatched to three parallel agents only AFTER Phase 2 lands (each phase touches at most one route file plus shared `services/imagePipeline/index.ts` — last-writer-wins on the orchestrator file means the three phases must rebase against each other; serialise the merges).
- Phase 9 reviewer agent ALWAYS spawned with zero context. Fix agents spawned separately, also zero context. Reviewer/fixer separation is hard.

---

## Notes

- **Constitution**: every commit MUST keep `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm cf-typegen` green.
- **Commit message style**: Conventional Commits, prefix `feat(007):` / `test(007):` / `chore(007):` per spec 005's example.
- **PR body**: link issue #6, link spec, list grep checks for SC-001/SC-002, list outcome-kind coverage for SC-003.
- **Verbatim preservation**: `NO_FAILURE` sentinel, `causeToErrorString`, `logPipelineOutcome`, `escapeHTML` (in script.ts) all stay byte-for-byte.
