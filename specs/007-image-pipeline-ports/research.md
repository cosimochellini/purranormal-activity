# Phase 0: Research — Image Pipeline Ports & Adapters

## Decision 1: Module shape — single directory vs flat file

**Decision**: Promote `services/imagePipeline.ts` to `services/imagePipeline/` directory with `index.ts`, `ports.ts`, `outcome.ts`, `adapters/`.

**Rationale**:
- The public surface is growing from one method (`run`) to three (`submit`, `generateImageFor`, `drainOnePending`).
- Four ports plus four adapters plus the orchestrator plus the outcome union plus tests do not fit a single flat file without reading like a 600-line wall.
- Spec `005-storyforge-consolidation` already used the directory pattern (`services/storyForge/{index,types,llm,categories}.ts`); adopting the same shape keeps the codebase consistent and lets future contributors recognise it as the standard "deep module" layout.

**Alternatives considered**:
- **Flat file with named export groups**: rejected — easy now, painful at the next slice. `services/imagePipeline.ts` is already 189 lines and the new shape adds ~3x.
- **Multiple top-level service files** (`imagePipelineSubmit.ts`, `imagePipelineDrain.ts`): rejected — fragments the state-machine owner across files; loses the "deep module" goal.

## Decision 2: Adapter dependency injection mechanism

**Decision**: Hand-rolled factory: `createImagePipeline(deps: PipelineDeps)` and `createDefaultImagePipeline(overrides?: Partial<PipelineDeps>)`. Singleton `pipeline` wired with the production adapters.

**Rationale**:
- Mirrors `services/storyForge/index.ts::createStoryForge` and `services/notifier/index.ts::createNotifier` — already-trusted patterns in this codebase.
- Zero new dependencies (no DI container).
- `Partial<PipelineDeps>` overrides allow tests to swap a single port without re-wiring the others, matching how `createDefaultImagePipeline(overrides?)` works today (`services/imagePipeline.ts:151-157`).

**Alternatives considered**:
- **Class-based ctor injection**: rejected — repo style is functional; no other module uses classes for service composition.
- **`tsyringe` / `inversify`**: rejected — out of scope, adds a runtime dep, and Workers' tree-shaking is more conservative than Node's.

## Decision 3: `submit` boundary — what stays in the route?

**Decision**: The route owns Zod validation, friendly-error mapping, `storyForge.logDetails()`, and `storyForge.categories()` (filtering to `allCategoryIds`). The pipeline owns row insert + category link + image-generation arc.

**Rationale**:
- `storyForge` is content/AI; pipeline is state-machine. The single-responsibility cut is clear.
- The route's friendly-error mapping is HTTP-shaped concern (response body shape, user-facing copy). Moving it into the pipeline would couple HTTP to the pipeline.
- Category filtering against `allCategoryIds` requires the route to have already called `storyForge.categories()` for its own DB-unavailable error path. Re-doing the call inside the pipeline would duplicate work and fragment error handling.

**Alternatives considered**:
- **Pipeline calls storyForge internally**: rejected — pipeline becomes a content-AI module and the route loses its ability to short-circuit on `storyForge.logDetails` returning `!ok` with a friendly text.
- **Pipeline handles categories without filter**: rejected — under-categorised rows ship to production if the route forgets the filter.

## Decision 4: Sequential drain vs. retain parallel batch

**Decision**: Replace 5-at-a-time `Promise.all` batches with a sequential `while (await pipeline.drainOnePending()) …` loop in `services/script.ts`.

**Rationale**:
- Matches the RFC interface verbatim. User explicitly chose this option (Loop drainOnePending) over parallel-batch and configurable-concurrency.
- The script is run rarely (cron-like / manual). Throughput loss from sequential drain is negligible against the operational simplicity gain (no `Promise.all` failure-aggregation edge cases, no inter-batch `wait(5000)`).
- Single-owner state-machine guarantee: only one isolate writes status at a time within one Worker, eliminating the race-window between `findFirstPending` and `loadStatus` to a single worst-case `skipped/not-pending` per concurrent submitter.

**Alternatives considered**:
- **Keep the parallel batch but wrap `drainOnePending`**: rejected — breaks the RFC's single-owner promise; reintroduces the failure-aggregation cases the refactor is meant to remove.
- **Configurable concurrency knob**: rejected — premature; can be added later (cf. RFC's "future `QueuePort`").

## Decision 5: Where does `Buffer` live?

**Decision**: `Buffer.from(base64, 'base64')` stays inside `services/imagePipeline/adapters/imageStore.ts` (the production adapter). The pipeline core works with `Uint8Array` only at the boundary (`ImageStorePort.put`).

**Rationale**:
- Constitution IV: production code MUST NOT use Node-only APIs in hot paths. `Buffer` is technically polyfilled by `@cloudflare/workers-types` but the cleaner port shape is `Uint8Array`.
- Confines the polyfill knowledge to one file. If a future adapter targets a different store (S3, Backblaze) it can do its own conversion without affecting the orchestrator.

**Alternatives considered**:
- **Pass base64 string straight to `ImageStorePort`**: rejected — the port's contract becomes "image store knows AI base64 format", which leaks AI concerns into storage.
- **Pipeline core does the conversion**: rejected — re-couples the orchestrator to `Buffer`.

## Decision 6: In-memory adapters location

**Decision**: `tests/fakes/imagePipeline.ts` exports `createInMemoryAiText`, `createInMemoryAiImage`, `createInMemoryImageStore`, `createInMemoryLogRepository`, and `createTestPipeline()` (which composes the four).

**Rationale**:
- `tests/` is already in `vitest.config.ts` `include`. Fakes live with tests, not with production code.
- One file means one place to evolve the fakes when ports change. Mirrors `tests/helpers.ts` (`makeFakeDb`, `mockOpenAIClient`, etc.).

**Alternatives considered**:
- **Per-port fake files** (`tests/fakes/aiText.ts`, …): rejected — four files for ~30-line helpers is over-engineering.
- **Inline fakes in the test file**: rejected — would make `services/imagePipeline/index.test.ts` ~500 lines and prevents reuse if a route-level integration test wants the same fakes later.

## Decision 7: `findFirstPending` ordering

**Decision**: `ORDER BY id ASC LIMIT 1`.

**Rationale** (per spec Clarification 2): SQLite returns rowid order = id order in practice for the existing query (`services/script.ts:95`). Making the order explicit prevents future engine upgrades from breaking FIFO semantics.

**Alternatives considered**:
- **`ORDER BY createdAt ASC`**: rejected — `createdAt` is a number; same as `id` in monotonicity but adds an index miss for no benefit.
- **No `ORDER BY`**: rejected — implicit ordering is brittle.

## Decision 8: Migrating existing tests

**Decision**: Delete `services/imagePipeline.test.ts` after extracting its unique edge cases into the new boundary suite. Keep `services/script.test.ts` but rewrite to assert drain-loop semantics with a fake pipeline. Keep `services/imageGen.test.ts` (narrow adapter test). Delete or update any submit-route test that mocked `imagePipeline.run` directly.

**Rationale**:
- The current `services/imagePipeline.test.ts` (40+ tests) mocks `@/drizzle`, `@/services/imageGen`, `@/services/storyForge`, `@/utils/cloudflare`. Boundary suite covers the same outcomes via in-memory adapters → mocks become dead weight.
- `services/script.test.ts` continues to verify the loop + Telegram alert + outer-catch contract (FR-010, FR-011) — those are script-level concerns, not pipeline-level.
- `services/imageGen.test.ts` validates the OpenAI adapter shape; a separate concern from the pipeline orchestration.

**Alternatives considered**:
- **Keep both old and new tests**: rejected — duplicate coverage, slower suite, two places to update on every adapter change.
- **Delete old tests without migration**: rejected — risks losing edge cases that are not currently in the spec (e.g., the `NO_FAILURE` sentinel test).
