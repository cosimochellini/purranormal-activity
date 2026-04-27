---

description: "Task list for StoryForge module consolidation (issue #7)"
---

# Tasks: StoryForge Module Consolidation

**Input**: Design documents from `/specs/005-storyforge-consolidation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storyForge.ts, quickstart.md

**Tests**: Test tasks ARE included — the constitution mandates Vitest coverage and the spec calls out inline-snapshot prompt tests, cache-lifecycle tests, and a regression test for the empty-log-insert bug.

**Organization**: Tasks are grouped by user story so each story can be independently implemented and tested. Foundational phase builds the StoryForge module; story phases migrate callers and add story-specific assertions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=bug fix, US2=maintainability, US3=type-safe contract)
- File paths are absolute under the repository root.

## Path Conventions

Single project layout (TanStack Start monorepo). Sources live at `services/`, `start/routes/`, `tests/`. No `src/` prefix.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Worktree + branch already exist (created in Phase 1 of the engineering plan). No additional setup needed.

- [x] T001 Worktree `.worktrees/005-storyforge-consolidation` created on branch `005-storyforge-consolidation`
- [x] T002 `pnpm install` completed inside the worktree

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the StoryForge module + extract `imageGen`. ALL user-story migrations depend on this phase. The module is fully unit-tested in isolation BEFORE any caller migrates.

**⚠️ CRITICAL**: No caller-site migration may begin until Phase 2 is complete and `pnpm test services/storyForge/` is green.

- [ ] T003 [P] Create `services/storyForge/types.ts` with `AIResult<T>`, `AIError`, `QuestionSpec`, `Answer`, `LogDetails`, `Category` (internal), `Deps` (internal), `StoryForge` interface — match contracts/storyForge.ts exactly
- [ ] T004 [P] Create `services/storyForge/prompts.ts` by moving the four prompt template functions and `CHARACTER_DESCRIPTIONS` + `COMMON_PROMPT_INSTRUCTIONS` constants verbatim from `services/prompts.ts`
- [ ] T005 [P] Create `services/storyForge/llm.ts` exporting the internal `Llm` port shape and `defaultLlm` adapter wrapping `@ai-sdk/openai` + `generateText` — adapter signature `text({ model, prompt }) => Promise<string>`
- [ ] T006 Create `services/storyForge/categories.ts` exporting the internal `CategoriesPort` shape and `createDefaultCategories(db)` factory: closure-scoped `Map<id, Category> | null` cache, `all()` populates on miss, `invalidate()` nulls the cache, empty DB result NOT memoized (matches `services/categories.ts:13` behaviour)
- [ ] T007 Create `services/storyForge/index.ts` exporting `createStoryForge(deps?: Partial<Deps>): StoryForge` factory + `storyForge: StoryForge` singleton. Each of 4 intent methods: build prompt, call `llm.text`, parse JSON, validate shape, return `AIResult<T>`. Catch infra errors → `{ ok: false, error: 'model', message }`. Catch `JSON.parse` → `{ ok: false, error: 'parse', message }`. Validation failure → `{ ok: false, error: 'validation', message }`. `telegramMessage` strips ` ```html ` and ` ``` ` fences before validating. `imagePrompt` and `logDetails` use `randomImageStyle()` from `@/data/enum/imageStyle`.
- [ ] T008 [P] Create `services/imageGen.ts` with `generateImageBase64(imagePrompt: string): Promise<string>` — body lifted verbatim from `services/ai.ts:78-96`, including `logger.error` and `throw new Error('Image generation failed')`
- [ ] T009 [P] [Tests] Create `services/imageGen.test.ts` covering happy path (returns base64) and failure path (throws `'Image generation failed'`), porting the relevant cases from `services/ai.test.ts`
- [ ] T010 [Tests] Create `services/storyForge/storyForge.test.ts` with the following sections:
  1. **Discriminated-union shape** — for each of the 4 intents, success returns `{ ok: true, value }` and validation/parse/model error variants narrow correctly via the `ok` field
  2. **Cache lifecycle** — `categories.all()` is called once across N intent invocations; called again after `invalidateCategories()`; empty DB result re-queries on next call
  3. **Prompt snapshots** — recording `llm` stub captures the prompt text; `expect(captured).toMatchInlineSnapshot(...)` for each of the 4 intent methods (first run writes the snapshot; later runs assert no drift)
  4. **Model selection** — each intent calls `llm.text` with its expected model id (`gpt-5-mini` for `questions` and `telegramMessage`, `gpt-5.2` for `logDetails` and `imagePrompt`)
  5. **HTML-tag stripping** — `telegramMessage` returns text with ` ```html ` and ` ``` ` fences trimmed
  6. **Non-Error throws** — when `llm.text` rejects with a non-Error value (string, undefined, plain object), the result still produces a printable `message` string and `error: 'model'`
  7. **Concurrent invalidate** — calling `invalidateCategories()` while an intent that calls `categories.all()` is in-flight causes the next intent invocation to re-fetch (does NOT serve a stale cached value)
- [ ] T011 Run `pnpm test services/storyForge services/imageGen` and confirm all new tests pass before proceeding to Phase 3

**Checkpoint**: StoryForge module is fully unit-tested, fully encapsulated, and ready for callers. Imports from `@/services/prompts` or `@/services/categories` outside the module DO NOT EXIST YET — but the new module is not yet wired to any caller.

---

## Phase 3: User Story 1 — Submit-time empty-log-insert bug fix (Priority: P1) 🎯 MVP

**Goal**: Visitor receives a friendly error AND no row is inserted when AI fails during `POST /api/log/submit`. This is the public-facing data-integrity fix.

**Independent Test**: Stub `storyForge.logDetails` to return `{ ok: false, error: 'model', message: 'OpenAI exploded' }`, POST a valid payload, assert `response.success === false`, `response.errors.general` is present, AND `db.insert(log)` was NOT called.

- [ ] T012 [US1] Migrate `start/routes/api/log/submit.ts`: replace `import { generateLogDetails } from '@/services/ai'` with `import { storyForge } from '@/services/storyForge'`. Call `const r = await storyForge.logDetails(result.data.description, result.data.answers)`. Add `if (!r.ok)` BEFORE `db.insert(log)` returning `{ success: false, errors: { general: [<mapped message via existing mapping logic on r.message>] } }` via the same `ok<LogSubmitResponse>` helper. Inside `if (r.ok)`, destructure from `r.value` and proceed with the existing insert flow.
- [ ] T013 [US1] [Tests] Update `tests/api/log.submit.test.ts`: switch `vi.mock('@/services/ai', ...)` to `vi.mock('@/services/storyForge', ...)`. Convert all happy-path mocks from `mockResolvedValueOnce({ title, description, ... })` to `mockResolvedValueOnce({ ok: true, value: { title, description, ... } })`. Convert error-throw cases (`mockRejectedValueOnce(new Error('OpenAI exploded'))`) to `mockResolvedValueOnce({ ok: false, error: 'model', message: 'OpenAI exploded' })` while keeping the existing assertion that the response is `{ success: false, errors.general }` and `X-Invalidate` header is null.
- [ ] T014 [US1] [Tests] Add NEW tests in `tests/api/log.submit.test.ts` named `'does not insert a log row when storyForge.logDetails returns ok:false'`. Cover BOTH variants: (a) `{ ok: false, error: 'model', message: 'OpenAI exploded' }` and (b) `{ ok: false, error: 'parse', message: 'Unexpected token in JSON' }`. POST a valid payload in each case, assert that `fakeDb.insert` was NOT called and that the response is `{ success: false, errors.general }` (use the existing `makeFakeDb()` helper).

**Checkpoint**: User Story 1 is verifiable in isolation. The bug-fix regression test asserts no DB row is inserted on AI failure. `pnpm test tests/api/log.submit.test.ts` passes.

---

## Phase 4: User Story 2 — Maintainable prompts via private module (Priority: P2)

**Goal**: Prompt templates live inside `services/storyForge/`, are NOT exported on the public surface, and are covered by inline snapshot tests so a single edit produces a single failing snapshot.

**Independent Test**: `grep -rn "from '@/services/prompts'" services/ start/ tests/ utils/ hooks/ components/` produces no output. Edit one prompt template; `pnpm test services/storyForge` shows exactly ONE snapshot mismatch.

- [ ] T015 [P] [US2] Migrate `start/routes/api/log/refine.ts`: replace `import { createQuestions } from '@/services/ai'` with `import { storyForge } from '@/services/storyForge'`. Call `const r = await storyForge.questions(description)`. On `!r.ok`: feed `r.message` through the existing pattern-matching block (`AI` / `OpenAI` / `network` / `fetch` / `timeout`) and return `{ success: false, errors: { description: [errorMessage] } }`. On `r.ok`: return `{ success: true, content: r.value }`. Keep the outer try/catch for unexpected throws.
- [ ] T016 [P] [US2] [Tests] Update `tests/api/log.refine.test.ts`: switch `vi.mock('@/services/ai', ...)` to `vi.mock('@/services/storyForge', ...)`. Convert happy-path mocks to `{ ok: true, value: [...] }` and error-throw mocks to `{ ok: false, error: 'model', message: 'OpenAI rate limit' }`. Existing response-shape assertions stay unchanged.
- [ ] T017 [US2] Migrate `services/notifier/index.ts:3,58`: replace `import { generateTelegramMessage } from '@/services/ai'` with `import { storyForge } from '@/services/storyForge'`. Default `composeMessage`: `(event) => storyForge.telegramMessage(event).then(r => r.ok ? r.value : Promise.reject(new Error(r.message)))`. The `composeMessage` port signature stays `(event) => Promise<string>`. No changes to `services/notifier/notifier.test.ts`.
- [ ] T018 [US2] Migrate `services/trigger.ts`: replace `import { generateImageBase64, generateImagePrompt } from '@/services/ai'` with `import { storyForge } from '@/services/storyForge'` and `import { generateImageBase64 } from '@/services/imageGen'`. Replace `await generateImagePrompt(logEntry.description)` with `const r = await storyForge.imagePrompt(logEntry.description); if (!r.ok) throw new Error(r.message); const imagePrompt = logEntry.imageDescription ?? r.value`. Throw on `!r.ok` to preserve `services/script.ts:17-19` per-log catch behaviour.
- [ ] T019 [US2] [Tests] Update `services/trigger.test.ts`: switch `vi.mock` paths from `@/services/ai` to BOTH `@/services/storyForge` (for `storyForge.imagePrompt` returning AIResult) AND `@/services/imageGen` (for `generateImageBase64`). Adjust mocks to AIResult shape for `imagePrompt`.
- [ ] T019b [US2] Migrate `static/promise.ts`: SSR branch currently does `import('../services/categories').then(m => m.getCategories())`. Replace with an inline query `import('../drizzle').then(({ db }) => import('../db/schema').then(({ category }) => db.select().from(category)))` (or equivalent `(async () => { const { db } = await import('../drizzle'); const { category } = await import('../db/schema'); return db.select().from(category) })()`). This is the only external caller of `services/categories.ts` outside the StoryForge module — the migration removes the last public dependency on it.

**Checkpoint**: All four caller sites migrated. `pnpm test` passes. `services/ai.ts`, `services/prompts.ts`, `services/categories.ts` are still on disk but have no remaining importers (verifiable via `grep -rn "from '@/services/ai'\|from '@/services/prompts'\|from '@/services/categories'" .` returning zero hits).

---

## Phase 5: User Story 3 — Type-safe AIResult contract enforcement (Priority: P2)

**Goal**: Verify the discriminated union forces compile-time error handling at every caller, by running `pnpm typecheck` against the migrated callers.

**Independent Test**: A deliberate misuse (`r.value.title` without checking `r.ok`) must produce a TypeScript error from `pnpm typecheck`.

- [ ] T020 [US3] Run `pnpm typecheck` and verify zero errors against the migrated callers (refine, submit, trigger, notifier).
- [ ] T021 [US3] [Manual] Manual verification: temporarily insert `const x = (await storyForge.questions('test')).value` in a scratch file (do NOT commit), run `pnpm typecheck`, observe TS error like `Property 'value' does not exist on type 'AIResult<...>'`. Remove the scratch line. (This task only validates SC-004 of the spec; it produces no committed code and no diff.)

**Checkpoint**: Compile-time discrimination is real. Spec SC-004 satisfied.

---

## Phase 6: Cleanup & Validation

**Purpose**: Delete superseded files, confirm full toolchain, prepare for PR.

- [ ] T022 [P] `git rm services/ai.ts services/ai.test.ts` (replaced by `services/storyForge/` for prompt-driven entries and `services/imageGen.ts` for the residual)
- [ ] T023 [P] `git rm services/prompts.ts services/prompts.test.ts` (moved into `services/storyForge/prompts.ts` as private; snapshot coverage is in `storyForge.test.ts`)
- [ ] T024 [P] `git rm services/categories.ts services/categories.test.ts` (absorbed into `services/storyForge/categories.ts` as a private port; cache lifecycle covered in `storyForge.test.ts`; `__resetCategoryCache` deleted)
- [ ] T025 Run `pnpm lint` — must report zero issues. Run `pnpm lint:fix` only if Biome flags import-organization fallout from the file moves.
- [ ] T026 Run `pnpm typecheck` — must report zero errors.
- [ ] T027 Run `pnpm test:coverage` — all tests green AND coverage thresholds (≥50% lines AND ≥50% branches per constitution Quality Gate #3) hold. Note: a pre-existing flake (`services/telegram/index.test.ts` failing because route-tree env loads pull `env/db.ts` without `TURSO_DATABASE_URL`) is unrelated to this PR and reproducible on `main`.
- [ ] T028 Run `pnpm build` — Vite + Cloudflare Worker build must succeed.
- [ ] T029 Run `quickstart.md` verification commands (the `grep -rn "from '@/services/prompts'"` and `grep -rn "from '@/services/categories'"` checks) and confirm both produce no output.
- [ ] T030 Commit the full set of changes with conventional-commit message: `feat(005): consolidate prompts + category cache into StoryForge module`.

**Checkpoint**: Repo is in a green, committable, deployable state. SC-001 through SC-005 of the spec are satisfied.

---

## Phase 7: PR + Multi-Agent Review Loop

**Purpose**: Open PR, run zero-context review subagents, iterate until P0/P1/P2 = 0.

- [ ] T031 `git push -u origin 005-storyforge-consolidation`
- [ ] T032 `gh pr create --title "feat(005): consolidate prompts + category cache into StoryForge module" --body "<heredoc summarising spec/plan/decisions/test coverage; closes #7>"`. Capture the PR URL.
- [ ] T033 Spawn an Opus subagent to run `/gh-pr-no-checkout-review <PR-URL>` against the open PR with zero conversation context. Report findings categorised by priority (P0/P1/P2/P3).
- [ ] T034 For every P0, P1, P2 finding: investigate, fix in the worktree, commit, push. Re-spawn a fresh Opus subagent for the next iteration.
- [ ] T035 Loop T033 → T034 until the latest review reports zero P0, P1, P2 findings (P3 is informational and not blocking per the spec's SC-006).
- [ ] T036 Final `pnpm lint && pnpm typecheck && pnpm test && pnpm build` after the last fix. Report PR URL + clean review report.

**Checkpoint**: Spec SC-006 satisfied — multi-agent review reports no P0/P1/P2 findings.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Already complete.
- **Phase 2 (Foundational)**: Blocks Phases 3–7. The StoryForge module + imageGen extraction must be implemented and unit-tested in isolation before any caller migrates.
- **Phase 3 (US1)**: Depends on Phase 2. Independently testable.
- **Phase 4 (US2)**: Depends on Phase 2. Tasks T015 ↔ T016 are paired; T017, T018, T019 sequence per file. Independently testable per caller-site migration.
- **Phase 5 (US3)**: Depends on Phases 3 + 4 (typecheck the migrated callers).
- **Phase 6 (Cleanup)**: Depends on Phases 3–5. Once T022–T024 delete the superseded files, full validation runs.
- **Phase 7 (Review loop)**: Depends on Phase 6 — only push and open the PR after `pnpm test && pnpm build` are green.

### Parallel Opportunities

- T003, T004, T005 [P] — three sibling files in `services/storyForge/`, no inter-dependency at creation time. Compose into T007 (index) afterwards.
- T008 [P] (imageGen) is independent of the StoryForge directory.
- T009 [P] (imageGen test) is independent of T010 (storyForge test).
- T015 ↔ T017 ↔ T018 in Phase 4 [P] — three separate caller files, independent edits. T016 / T019 are paired with their callers.
- T022, T023, T024 [P] in Phase 6 — three independent `git rm` commands.

### Within Each User Story

- T010 (StoryForge tests) MUST be written and FAIL or contain placeholder snapshots BEFORE T007 final implementation lands.
- T013, T014 (US1 tests) MUST run after T012 (US1 implementation) so the new mocks resolve.
- T020 (typecheck) MUST run after all caller migrations are complete.

---

## Parallel Example: Phase 2 Foundational

```bash
# Three sibling module files can be created in parallel:
Task: "Create services/storyForge/types.ts"           # T003
Task: "Create services/storyForge/prompts.ts"         # T004
Task: "Create services/storyForge/llm.ts"             # T005

# Once those land, the index that wires them up:
Task: "Create services/storyForge/index.ts"           # T007 (depends on T003-T006)

# Independent of the StoryForge directory:
Task: "Create services/imageGen.ts"                   # T008
Task: "Create services/imageGen.test.ts"              # T009
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
2. Complete Phase 3: User Story 1 (the bug fix that delivers public-facing value).
3. **STOP and VALIDATE**: Test User Story 1 independently. If only this story shipped, the empty-log-insert bug would be FIXED even though `services/ai.ts` etc. would still be on disk.
4. In practice, since this is a single-PR refactor, continue to Phase 4 immediately.

### Incremental Delivery

1. Phase 2 → Foundation ready.
2. Phase 3 → MVP: bug fix shipped.
3. Phase 4 → Full caller migration done; Phase 5 verifies type safety.
4. Phase 6 → Cleanup deletions + green toolchain.
5. Phase 7 → Open PR, review-loop, merge.

### Parallel Team Strategy

This task is sized for one developer in one session; parallel team execution is not relevant.

---

## Notes

- [P] = different files, no dependencies between the marked tasks at the same step.
- [Story] label maps tasks to user stories from spec.md (US1=P1 bug fix, US2=P2 maintainability, US3=P2 type-safe contract).
- Verify tests fail before implementing — this is enforced by Phase 2's checkpoint and the discriminated-union test cases in T010.
- Commit after each phase or logical group; the final atomic commit (T030) lands the squashable PR contents.
- The pre-existing `services/telegram/index.test.ts` env-load flake is documented in T027 and is NOT in scope for this PR.
