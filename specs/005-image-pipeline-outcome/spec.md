# Feature Specification: `imagePipeline.run()` with Discriminated `PipelineOutcome`

**Feature Branch**: `005-image-pipeline-outcome`
**Created**: 2026-04-26
**Status**: Draft
**Input**: GitHub Issue #10 — "RFC: imagePipeline.run() with discriminated PipelineOutcome".

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Callers Stop Memorizing Per-Function Failure Modes (Priority: P0)

As a maintainer touching any of the three image-generation entry points
(`/api/log/submit`, `/api/script`, `/api/trigger/$id`), I want a single
`pipeline.run(logId)` call whose outcome I `switch` over exhaustively, so I
never have to remember which of the legacy helpers throws and which returns
`false`.

**Why this priority**: today
`services/trigger.ts:8-28` `triggerLogImage` THROWS on missing log,
`services/trigger.ts:30-45` `triggerLogImageIfPending` RETURNS `false` on
missing log, and `services/content.ts:15-26`
`shouldMarkImageTriggerError` only records errors when the id passes
`Number.isFinite`. The three entry points each pick a different combination
and have already drifted; the contract is held together by a single
regression test (`services/log.test.ts:212-228`).

**Independent Test**: After the refactor, every entry point body uses
`switch (outcome.kind)` over `'success' | 'skipped' | 'failed-recorded' |
'failed-write-also-failed'`. A `grep` for `triggerLogImage`,
`triggerFirstPendingImage`, or `shouldMarkImageTriggerError` outside
deleted spec docs returns zero hits.

**Acceptance Scenarios**:

1. **Given** the legacy helpers are deleted, **When** I `grep -r
   "triggerLogImage\\|triggerFirstPendingImage\\|shouldMarkImageTriggerError"
   --include="*.ts"`, **Then** zero hits outside `specs/`.
2. **Given** every caller of the pipeline, **When** TypeScript compiles in
   strict mode, **Then** the `switch (outcome.kind)` in each caller is
   exhaustive — adding a hypothetical fifth variant produces a compile
   error in every entry point.
3. **Given** the unit test suite for the pipeline, **When** I read the
   tests, **Then** all four outcome variants plus both skipped reasons are
   exercised by at least one assertion.

---

### User Story 2 — DB Write Failures During Error-Recording Are Never Silent (Priority: P0)

As an operator paged at 03:00 by a Cloudflare alert, when image generation
fails AND the subsequent error-recording DB write *also* fails, I want a
loud Telegram alert so I learn about the double-fault before the next
batch run masks it. Today `services/log.ts:107-123` `setLogError` swallows
write errors with `logger.warn` only.

**Why this priority**: a swallowed double-fault leaves a row stuck in
`status='Created'` with no `error` column populated, so the next batch
re-picks it up, fails the same way, swallows again — an infinite-loop
billing waste with no signal.

**Independent Test**: Mock the default-deps `recordError` to throw. Drive
the pipeline through `runImageGenerationScript`. Assert (a) the loop
keeps going for the remaining logs in the batch, (b) `notifier`-equivalent
fan-out (`services/telegram.sendMessage`) was called for every configured
chat, and (c) `logger.error` carried `{ logId, cause, writeError }`.

**Acceptance Scenarios**:

1. **Given** `generate` throws and `recordError` resolves, **When** the
   pipeline returns, **Then** `outcome.kind === 'failed-recorded'` and
   `outcome.cause` carries the original error.
2. **Given** `generate` throws and `recordError` also throws, **When** the
   pipeline returns, **Then** `outcome.kind === 'failed-write-also-failed'`
   and both `cause` and `writeError` are present on the outcome.
3. **Given** the batch driver receives a `failed-write-also-failed`
   outcome, **When** it processes the rest of the batch, **Then** every
   configured `TELEGRAM_BOT_CHAT_IDS` chat received a Telegram message
   describing `logId`, `cause`, and `writeError` (best-effort fan-out;
   per-chat send failures are themselves logged but never throw past the
   pipeline boundary).

---

### User Story 3 — Failed Logs Stop Re-Entering the Retry Pool (Priority: P1)

As an operator, when a log fails the image pipeline, I want it to leave
the `Created` status — so the next `runImageGenerationScript` query
(`WHERE status = 'Created'`) naturally excludes it without per-row
filter logic. Today `setLogError` only writes the `error` column and
leaves status untouched, which keeps the row visible to the batch driver
forever.

**Why this priority**: the dormant `LogStatus.Error` enum value already
exists (`data/enum/logStatus.ts:4`). Activating it is a one-line change in
the new `recordError` dep.

**Independent Test**: Drive the pipeline through `failed-recorded`. Read
the row from the fake DB. Assert `status === 'Error'` AND `error` column
is populated, both written in a single `update().set()` call.

**Acceptance Scenarios**:

1. **Given** `failed-recorded`, **When** I read the row, **Then**
   `status === LogStatus.Error` AND `error !== null`.
2. **Given** an `Error`-status row in the DB, **When**
   `runImageGenerationScript` queries pending logs, **Then** the row is
   not returned (the `WHERE status = 'Created'` filter excludes it).
3. **Given** the default-deps `recordError`, **When** it executes, **Then**
   it issues exactly one Drizzle `update().set({...}).where(...)` call
   that contains both `status` and `error` keys.

---

### User Story 4 — Pipeline Module is Test-Substitutable (Priority: P1)

As a test author, I want to verify the four outcome variants without
spinning up libsql or hitting OpenAI, so the boundary suite is
synchronous, deterministic, and runs in <50ms.

**Why this priority**: the legacy `services/trigger.test.ts` and
`services/content.test.ts` mock five concrete dependencies (drizzle
chainable, AI client, R2 uploader, logger, getLog). The new pipeline
takes four typed callbacks; tests pass synchronous in-memory functions —
zero infrastructure mocks required.

**Independent Test**: A test file imports `createImagePipeline` and
constructs a pipeline from four `vi.fn()` callbacks. The whole 5-case
suite runs in well under one second, with no `vi.mock` for `@/drizzle`,
`@/services/ai`, or `@/utils/cloudflare` needed for those tests.

**Acceptance Scenarios**:

1. **Given** the boundary suite, **When** I read the file, **Then** zero
   `vi.mock` calls are required for the pure-pipeline cases.
2. **Given** the default-deps cases, **When** I read the file, **Then**
   only the existing `tests/helpers.ts` `makeFakeDb` is used to assert the
   single-update shape — no new test fixtures.

---

## Functional Requirements

- **FR-1**: A new module `services/imagePipeline.ts` exports
  `createImagePipeline(deps): ImagePipeline`, `createDefaultImagePipeline(overrides?)`,
  the `ImagePipeline` interface, the `PipelineDeps` interface, and the
  `PipelineOutcome` union.
- **FR-2**: `PipelineOutcome` is exactly the 4-variant discriminated union
  from the RFC. No additional fields, no clock, no timestamps.
- **FR-3**: `pipeline.run(logId)` is a pure orchestrator: it never throws.
  Every code path returns one of the 4 variants.
- **FR-4**: Default `recordError` writes `{ status: LogStatus.Error, error: <msg> }`
  in a **single** `db.update(log).set(...).where(...)` call and re-throws on
  DB failure (no swallowing). The pipeline catches that throw and emits
  `failed-write-also-failed`.
- **FR-5**: Three current entry points migrate to `pipeline.run`:
  - `start/routes/api/log/submit.ts` (sync from submit)
  - `start/routes/api/log/$id.ts` (PUT regenerates image when prompt changed)
  - `start/routes/api/trigger/$id.ts` (individual trigger)
  - `services/script.ts` (batch). The batch driver alerts via
    `services/telegram.sendMessage` on `failed-write-also-failed` and never
    throws.
- **FR-6**: `services/content.ts`, `services/content.test.ts`,
  `services/trigger.ts`, `services/trigger.test.ts` are deleted. The
  public export `setLogError` from `services/log.ts` is deleted, and its
  3+ `setLogError` test cases are removed (the bug-#16 regression role is
  filled by the `failed-write-also-failed` boundary test).

## Non-Functional Requirements

- **NFR-1**: All four verification gates pass green: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **NFR-2**: Vitest coverage thresholds (50% on lines/branches/functions/
  statements) are met.
- **NFR-3**: No new runtime dependencies. No new env vars.

## Out of Scope

- The umbrella `EventPipeline` (RFC ports & adapters). If/when it lands,
  `EventPipeline.generateImageFor` returns `PipelineOutcome` directly and
  `services/imagePipeline.ts` is folded into it.
- Retry logic, exponential backoff, or per-row attempt counters.
- Error classification (transient vs permanent). All errors land in the
  same `Error` status; differentiation can come later.
