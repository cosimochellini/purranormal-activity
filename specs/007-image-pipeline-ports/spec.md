# Feature Specification: Image Pipeline Behind Ports & Adapters

**Feature Branch**: `007-image-pipeline-ports`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "RFC #6: Deepen image-generation pipeline behind ports & adapters. Refactor the AI image-generation pipeline so the deep module owns the Created → ImageGenerated|Error state machine and routes never import OpenAI, R2, or Drizzle directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Submit a paranormal event and have its image generated end-to-end (Priority: P1)

A logged-in admin pastes a paranormal event description into `/new`, answers any clarifying questions, and submits. The system enriches the description with AI, persists a Created log row, links categories, generates the image, uploads it to storage, and marks the row ImageGenerated — all behind a single pipeline call from the route handler. The route handler does not import the AI client, the storage client, or the database for pipeline-state mutations.

**Why this priority**: This is the dominant production path. If submit is broken, the product is broken.

**Independent Test**: With all four in-memory adapters wired to a freshly built pipeline, calling `submit(input)` once returns `{ id, outcome: { kind: 'success', logId: id } }`, the in-memory repository shows status `ImageGenerated`, and the in-memory image store contains exactly one entry keyed by that id.

**Acceptance Scenarios**:

1. **Given** valid `SubmitInput` (description, answers, categoryIds, details), **When** `pipeline.submit(input)` is called, **Then** it inserts a row with status `Created`, links category rows, generates and uploads the image, marks the row `ImageGenerated`, and returns `{ id, outcome: { kind: 'success' } }`.
2. **Given** the AI image step throws (rate limit, content policy, network), **When** `pipeline.submit(input)` is called, **Then** the row exists, the row's status is `Error`, the row's `error` column carries the unwrapped cause message, and the returned outcome is `{ kind: 'failed-recorded' }`.
3. **Given** the row insert itself fails, **When** `pipeline.submit(input)` is called, **Then** the function rejects with the underlying error (no partial state); the route handler's outer try/catch maps it to `friendlyCatchText`.
4. **Given** `markImageGenerated` succeeds but `recordError` fails, **When** the AI step also failed, **Then** the outcome is `{ kind: 'failed-write-also-failed' }` and the script's Telegram alert fires (covered by US3).

---

### User Story 2 — Manually re-trigger image generation for a single existing log (Priority: P1)

An admin lands on `/<id>/edit` and updates the image description, or hits `POST /api/trigger/<id>` directly. The route handler invokes `pipeline.generateImageFor(id)` and exhaustively switches on `outcome.kind` to produce its HTTP response.

**Why this priority**: Edits and manual retries are the main recovery path when an image fails or content needs a refresh. Operators rely on this daily.

**Independent Test**: With a fake repository pre-loaded with a `Created` row, `pipeline.generateImageFor(id)` returns `{ kind: 'success' }`. With the same row pre-loaded as `ImageGenerated`, the same call returns `{ kind: 'skipped', reason: 'not-pending' }` and never invokes the AI or store ports. With no row at all, it returns `{ kind: 'skipped', reason: 'not-found' }`.

**Acceptance Scenarios**:

1. **Given** a row in `Created`, **When** `generateImageFor(id)` is called, **Then** the AI text port refines the prompt (or the stored `imageDescription` is used when present), the AI image port generates base64, the store port uploads, the repository marks `ImageGenerated`, and the outcome is `{ kind: 'success' }`.
2. **Given** the row's `imageDescription` is non-empty, **When** `generateImageFor(id)` is called, **Then** the AI text port is **not** invoked — the stored prompt is used directly. (Preserves current behaviour from `services/imagePipeline.ts:99-112`.)
3. **Given** a row in `ImageGenerated` or `Error`, **When** `generateImageFor(id)` is called, **Then** outcome is `{ kind: 'skipped', reason: 'not-pending' }` and no port mutates state.
4. **Given** a non-existent id, **When** `generateImageFor(id)` is called, **Then** outcome is `{ kind: 'skipped', reason: 'not-found' }`.
5. **Given** the AI text port returns `{ ok: false, error, message }`, **When** `generateImageFor(id)` is called, **Then** the failure is surfaced through the same try/catch path as a thrown image-generation error and the persisted error string preserves the AIError discriminator on `cause`.
6. **Given** `loadStatus` itself throws, **When** `generateImageFor(id)` is called, **Then** the pipeline still attempts `recordError` on the assumed-existing row (preserving the `NO_FAILURE` sentinel behaviour), returning either `failed-recorded` or `failed-write-also-failed`.

---

### User Story 3 — Drain pending Created rows from the batch endpoint (Priority: P1)

An operator (or scheduled cron) hits `POST /api/script`. The script service repeatedly calls `pipeline.drainOnePending()` until it returns `null`, processing one log per iteration. For each `failed-write-also-failed` outcome the script alerts Telegram (HTML-escaped) so silent failure remains impossible. Other outcomes are logged but do not alert.

**Why this priority**: This is how the system catches up after an outage or after a batch insert that bypassed `submit`. Without it, stuck `Created` rows accumulate.

**Independent Test**: With three `Created` rows and one `ImageGenerated` row pre-loaded, the script processes exactly three rows in three iterations, returns `{ success: true, processed: 3 }`, and on a re-run returns `{ success: true, processed: 0 }`. With one row whose AI port throws and whose `markError` also throws, exactly one Telegram alert is fired with the HTML-escaped cause.

**Acceptance Scenarios**:

1. **Given** N `Created` rows exist, **When** `runImageGenerationScript()` is called, **Then** it calls `drainOnePending()` exactly N+1 times (the last returning `null`) and returns `{ success: true, processed: N }`.
2. **Given** a `Created` row that produces a `failed-write-also-failed` outcome, **When** the script processes it, **Then** Telegram alert text contains `🚨 Image pipeline write-also-failed`, `logId: <id>`, the HTML-escaped cause string, and the HTML-escaped writeError string.
3. **Given** `TELEGRAM_BOT_CHAT_IDS` is empty, **When** a `failed-write-also-failed` occurs, **Then** no Telegram call is made and the script still returns `{ success: true, processed: <count> }`.
4. **Given** `drainOnePending` itself throws, **When** the script catches it, **Then** the script returns `{ success: false, processed: 0, error: 'Failed to process logs' }` (preserving the current outer-catch contract).

---

### User Story 4 — Routes are decoupled from external services (Priority: P2)

Reading any of the four affected route files, a developer sees no direct import of `OpenAI`, `S3Client`, `@/services/imageGen`, `@/utils/cloudflare`, or low-level Drizzle helpers (`eq`, `log` table) for pipeline-state mutations. The route only imports `pipeline` (and `storyForge` for content enrichment, which is out of scope).

**Why this priority**: The whole point of the refactor — without this, the deep module is leaky and the testability gain is lost.

**Independent Test**: A simple grep across `start/routes/api/log/submit.ts`, `start/routes/api/log/$id.ts`, `start/routes/api/trigger/$id.ts`, and `services/script.ts` for the strings `from '@/services/imageGen'`, `from '@/utils/cloudflare'`, and `db.insert(log)` returns no matches.

**Acceptance Scenarios**:

1. **Given** the refactor is complete, **When** searching the four files for imports of `imageGen`, `cloudflare.ts`, or low-level `db.insert(log)` / `db.update(log)`, **Then** zero matches are found.
2. **Given** a developer wants to swap the image model from OpenAI to a local stub for staging, **When** they only edit the adapter implementation in `services/imagePipeline/adapters/aiImage.ts`, **Then** no route file changes and no pipeline test changes.

---

### User Story 5 — Boundary tests cover the pipeline without per-seam mocks (Priority: P2)

A developer reads `services/imagePipeline/index.test.ts` and sees no `vi.mock` calls for pipeline-internal seams. All scenarios are exercised by wiring four in-memory adapters from `tests/fakes/imagePipeline.ts` into `createImagePipeline(deps)`. The Drizzle, OpenAI, and R2 modules are never imported by the test.

**Why this priority**: Boundary tests are the durable acceptance signal — they survive refactors of the adapters. Mock-the-world tests don't.

**Independent Test**: `pnpm test services/imagePipeline/index.test.ts` runs the suite without loading `@/drizzle`, `@/services/imageGen`, or `@/utils/cloudflare` (verifiable by greppable absence of `vi.mock('@/drizzle')` etc.).

**Acceptance Scenarios**:

1. **Given** the new test file, **When** searching it for `vi.mock('@/drizzle')`, `vi.mock('@/services/imageGen')`, `vi.mock('@/services/storyForge')`, or `vi.mock('@/utils/cloudflare')`, **Then** zero matches are found.
2. **Given** a hostile reviewer adding a wrong adapter behaviour, **When** the boundary test runs, **Then** it fails on observable state in the in-memory repository or store, not on a mock-call count.

---

### Edge Cases

- **Submit succeeds, image step fails, recordError fails too**: outcome is `failed-write-also-failed`; the row stays `Created` (not `Error`); the Telegram alert from the script (later) is the only durable signal. Submit route logs via `logPipelineOutcome` but still returns `success: true` (the row exists and is reachable).
- **`linkCategories` is called with an empty list**: no-op, no insert; `submit` proceeds.
- **`linkCategories` is called with a categoryId that's not in `allCategoryIds`**: filter happens in the route (preserved from current code), so the pipeline trusts its input.
- **`drainOnePending` and a concurrent `generateImageFor(id)` race on the same row**: `generateImageFor` will see status `ImageGenerated` (or `Error`) on its second-fastest path and return `skipped/not-pending`. No double-upload; no double `markGenerated`.
- **`imageDescription` is null AND `storyForge.imagePrompt` returns `{ ok: false }`**: outcome is `failed-recorded`; the persisted error message is the AIError's `message` (not the wrapper's `"Image prompt generation failed"`), and `cause.kind` carries the AIError discriminator.
- **`uploadToR2` succeeds, `markImageGenerated` fails**: outcome is `failed-recorded` (or `failed-write-also-failed` if `markError` also fails); the image is leaked in R2. Cleanup is out of scope (not present in current behaviour either).
- **Telegram alert throws while sending**: the script logs but does not propagate; the script outcome stays `{ success: true, processed: N }`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST expose exactly three public methods: `submit(input)`, `generateImageFor(logId)`, and `drainOnePending()`. The previously-public `run(logId)` MUST be removed.
- **FR-002**: The pipeline MUST accept four injected ports — AI text, AI image, image store, log repository — and MUST contain no top-level imports of `OpenAI`, `@aws-sdk/client-s3`, `@/drizzle`, `@/services/imageGen`, or `@/utils/cloudflare` from `services/imagePipeline/index.ts`.
- **FR-003**: A `createImagePipeline(deps)` factory MUST exist for tests. A `createDefaultImagePipeline(overrides?)` factory MUST exist for production wiring. A singleton `pipeline` MUST be exported for callers that don't need overrides.
- **FR-004**: `PipelineOutcome` MUST be preserved verbatim as the discriminated union with kinds `success`, `skipped` (with reason `not-found` | `not-pending`), `failed-recorded`, and `failed-write-also-failed`. `logPipelineOutcome` MUST remain exported.
- **FR-005**: `submit(input)` MUST insert a `Created` log row, MUST link any provided category ids (filtering already happens at the call-site), and MUST then run the same image-generation arc as `generateImageFor`. The return value MUST be `{ id, outcome: PipelineOutcome }`.
- **FR-006**: `generateImageFor(logId)` MUST preserve the `NO_FAILURE` sentinel ordering: a throw from `loadStatus` MUST still attempt `recordError` on the assumed-existing row.
- **FR-007**: `generateImageFor(logId)` MUST short-circuit to `{ kind: 'skipped', reason: 'not-pending' }` for any status other than `Created`. It MUST short-circuit to `{ kind: 'skipped', reason: 'not-found' }` when the row is absent.
- **FR-008**: `generateImageFor(logId)` MUST use `imageDescription` when non-empty; otherwise MUST call the AI text port and propagate `{ ok: false }` results into the same failure path with the AIError discriminator preserved on `cause.kind`.
- **FR-009**: `drainOnePending()` MUST return `PipelineOutcome | null`. `null` MUST be returned only when no `Created` row exists.
- **FR-010**: `services/script.ts::runImageGenerationScript` MUST call `drainOnePending()` in a sequential `while` loop. The 5-at-a-time `Promise.all` batch MUST be removed; `BATCH_SIZE` and `DELAY_MS` constants MUST be deleted.
- **FR-011**: `services/script.ts` MUST continue to fire a Telegram alert (HTML-escaped) on `failed-write-also-failed` outcomes and MUST NOT alert on any other outcome kind.
- **FR-012**: The four affected route files (`start/routes/api/log/submit.ts`, `start/routes/api/log/$id.ts`, `start/routes/api/trigger/$id.ts`, and `services/script.ts`) MUST not import `@/services/imageGen` or `@/utils/cloudflare`. `submit.ts` MUST not call `db.insert(log)` or `db.insert(logCategory)` directly.
- **FR-013**: A new file `tests/fakes/imagePipeline.ts` MUST export in-memory implementations of all four ports and a `createTestPipeline()` helper.
- **FR-014**: A new file `services/imagePipeline/index.test.ts` MUST cover the success/skipped/failed-recorded/failed-write-also-failed paths for both `submit` and `generateImageFor`, plus the empty-queue and pick-first-Created paths for `drainOnePending`. The test MUST NOT call `vi.mock` on `@/drizzle`, `@/services/imageGen`, `@/services/storyForge`, or `@/utils/cloudflare`.
- **FR-015**: `pnpm lint` (Biome), `pnpm test` (Vitest with the existing 50% coverage threshold), and `pnpm build` (Vite + `@cloudflare/vite-plugin`) MUST all be green at the end of every implementation slice.
- **FR-016**: Existing tests that mocked individual seams (`generateImageBase64`, `uploadToR2`, etc.) MUST be deleted or migrated to use the in-memory adapters once the boundary suite covers their cases. No silent loss of coverage is acceptable.
- **FR-017**: `causeToErrorString` MUST be preserved verbatim and used by the default `markError` adapter so the DB error column shows the unwrapped cause message (e.g. `"rate limit"`, not `"Image generation failed"`).

### Key Entities

- **Log row**: id, title, description, imageDescription (nullable), status (`Created` | `ImageGenerated` | `Error`), error (nullable string), createdAt, updatedAt. Owned by `LogRepositoryPort`.
- **Log↔Category link**: `(logId, categoryId)` pair. Owned by `LogRepositoryPort.linkCategories`.
- **PipelineOutcome**: discriminated union (preserved verbatim from spec `005-image-pipeline-outcome`).
- **SubmitInput**: `{ description, answers, categoryIds, details: LogDetails }`. `LogDetails` (title, description, imageDescription, categories) is produced upstream by `storyForge.logDetails()` and handed to the pipeline.
- **DraftLog**: subset of Log row fields the repository's `insertDraft` accepts (title, description, imageDescription, status). Used internally by `submit`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A grep for `from '@/services/imageGen'` and `from '@/utils/cloudflare'` across `start/routes/api/**` and `services/script.ts` returns zero matches after the refactor.
- **SC-002**: `services/imagePipeline/index.test.ts` passes without invoking `vi.mock` on any of `@/drizzle`, `@/services/imageGen`, `@/services/storyForge`, `@/utils/cloudflare`.
- **SC-003**: All four pipeline outcome kinds (`success`, `skipped`, `failed-recorded`, `failed-write-also-failed`) are exercised at least once in the boundary suite for both `submit` and `generateImageFor`.
- **SC-004**: `pnpm lint`, `pnpm test`, and `pnpm build` all return exit code 0 on the final commit. Coverage threshold (50% for branches, lines, statements, functions) holds or improves.
- **SC-005**: The `/api/script` end-to-end smoke (sequential drain) processes the same number of pre-existing `Created` rows in one invocation as the current parallel-batch implementation. Re-run after completion processes 0 rows (idempotent).
- **SC-006**: The PR review run by `/gh-pr-no-checkout-review` returns zero findings of priority P0, P1, or P2 before merge.

## Assumptions

- **Adapter swap is internal**: production wiring continues to use OpenAI text/image, R2 storage, and Drizzle-on-Turso. The refactor adds the seams without changing the adapters' externally-observable behaviour.
- **`storyForge.logDetails()` and `storyForge.categories()` stay outside the pipeline**: the route still owns content/AI enrichment and category resolution. The pipeline only owns the `Created → ImageGenerated|Error` arc and the row insert.
- **`Buffer`/`Uint8Array` conversion lives in the storage adapter**, not in the pipeline core. Workers' lack of a global `Buffer` is the storage adapter's concern.
- **`PipelineOutcome` shape is locked** by spec `005-image-pipeline-outcome` and is not renegotiated in this RFC.
- **Worker isolation**: cross-isolate races on `drainOnePending` and `generateImageFor` are not addressed by this RFC. Turso's per-row write atomicity plus the status-gate check is treated as sufficient.
- **The submit route's existing Zod validation, friendly-error mapping, and `storyForge` calls stay in the route**. Only the database/category-link/pipeline-run portion moves.
- **Image leak on partial failure (uploaded but DB not updated) is accepted**: existing behaviour does not clean up; this RFC does not change that.
