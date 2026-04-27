# Implementation Plan: Image Pipeline Behind Ports & Adapters

**Branch**: `007-image-pipeline-ports` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-image-pipeline-ports/spec.md`

## Summary

Refactor the AI image-generation pipeline so the deep module (`services/imagePipeline/`) owns the `Created → ImageGenerated|Error` state machine behind four injected ports (`AiTextPort`, `AiImagePort`, `ImageStorePort`, `LogRepositoryPort`). Replace the current single-method `run(logId)` API with three methods that map 1:1 to the three callers: `submit(input)` for `POST /api/log/submit`, `generateImageFor(logId)` for PUT `/api/log/$id` and `POST /api/trigger/$id`, and `drainOnePending()` for `POST /api/script`. Replace the parallel-batch loop in `services/script.ts` with a sequential `while (await pipeline.drainOnePending()) …` loop. Add a single boundary-test file that wires four in-memory adapters from `tests/fakes/imagePipeline.ts` — no per-seam `vi.mock` of `@/drizzle`, `@/services/imageGen`, `@/services/storyForge`, or `@/utils/cloudflare`. `PipelineOutcome` and `logPipelineOutcome` are preserved verbatim.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), targeting ES2022 / Cloudflare Workers runtime.
**Primary Dependencies**: TanStack Start 1.162.9, Vite 7.3.1, `@cloudflare/vite-plugin` 1.25.5, Drizzle ORM (libsql/web), `ai` SDK (`@ai-sdk/openai`), `@aws-sdk/client-s3` (R2), Zod, `nuqs`.
**Storage**: Turso (SQLite via `drizzle-orm/libsql/web`); Cloudflare R2 (S3-compatible) for generated images.
**Testing**: Vitest (`environment: node`, separate from app's Vite build to avoid the Cloudflare/TanStack plugins per Constitution IV).
**Target Platform**: Cloudflare Workers (deployed via `wrangler deploy`).
**Project Type**: Web service (TanStack Start file-based routes under `start/routes/`).
**Performance Goals**: No new latency budget — refactor must preserve sub-second `submit` p95 and the existing `/api/script` runtime envelope (≤ 5s × N for N pending rows; sequential drain accepts a slightly higher upper bound but matches current per-batch wall-clock).
**Constraints**: No global `Buffer` in Workers — base64 → bytes conversion stays inside `imageStore` adapter (current behaviour). No transactional wrapper across `log` and `logCategory` writes (Turso libsql/web doesn't expose one).
**Scale/Scope**: Single-tenant; hundreds-to-thousands of total log rows; tens of `Created` rows in the queue at any one time.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I. Test-First Pragmatism** | PASS | Boundary tests added at `services/imagePipeline/index.test.ts`. Vitest. Coverage threshold (50% lines + branches) preserved or improved by exercising 4 outcome kinds x 2 entry points + drain paths. Determinism: in-memory adapters; no real network/DB/clock. |
| **II. Boundary Mocking** | PASS | The pipeline boundary IS the test seam. `vi.mock` on `@/drizzle` / `openai` / `@aws-sdk/client-s3` / global `fetch` is unnecessary inside the pipeline test because the in-memory adapters replace those at the port level. Narrow adapter unit tests may still mock the underlying SDK. |
| **III. Type-Safe Edges** | PASS | Zod validation in `submit.ts` route stays in the route. Pipeline `submit` accepts an already-typed `SubmitInput` interface. No env reads at module load — adapters resolve env via existing `env/*.ts` modules. |
| **IV. Cloudflare-First Simplicity** | PASS | No new Node-only API usage. `Buffer` use confined to `imageStore` adapter (matches current `services/imagePipeline.ts:116`). Vitest config untouched. |
| **V. Observability** | PASS | `logger` used everywhere; no `console.*`. `logPipelineOutcome` preserved. No new `.catch` blocks that swallow errors silently. The script's Telegram alert path (HTML-escaped) on `failed-write-also-failed` is preserved. |

**Result**: GATE PASS. No violations; `Complexity Tracking` left empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-image-pipeline-ports/
|- plan.md              # This file
|- spec.md
|- research.md          # Phase 0 output
|- data-model.md        # Phase 1 output
|- quickstart.md        # Phase 1 output
|- contracts/
|   `- ports.md         # Port interface contracts
|- checklists/
|   `- requirements.md  # Spec quality checklist
`- tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
services/
|- imagePipeline/                       # NEW — replaces services/imagePipeline.ts
|   |- index.ts                         # createImagePipeline, createDefaultImagePipeline,
|   |                                   # singleton `pipeline`, logPipelineOutcome,
|   |                                   # PipelineOutcome (re-export)
|   |- ports.ts                         # AiTextPort, AiImagePort, ImageStorePort,
|   |                                   # LogRepositoryPort, SubmitInput, DraftLog, LogRow
|   |- outcome.ts                       # PipelineOutcome, NO_FAILURE sentinel,
|   |                                   # causeToErrorString
|   |- index.test.ts                    # Boundary tests (no per-seam vi.mock)
|   `- adapters/
|       |- aiText.ts                    # wraps services/storyForge.imagePrompt
|       |- aiImage.ts                   # wraps services/imageGen.generateImageBase64
|       |- imageStore.ts                # wraps utils/cloudflare.uploadToR2 + deleteFromR2
|       `- logRepository.ts             # wraps Drizzle on log + logCategory
|- imageGen.ts                          # unchanged (used by aiImage adapter)
|- imageGen.test.ts                     # unchanged
|- script.ts                            # MODIFIED — drainOnePending loop
|- script.test.ts                       # MODIFIED — assert drain loop semantics
|- storyForge/                          # unchanged
`- ...

start/routes/api/
|- log.ts                               # unchanged
|- log/
|   |- submit.ts                        # MODIFIED — calls pipeline.submit()
|   `- $id.ts                           # MODIFIED — pipeline.generateImageFor in PUT
|- trigger/
|   `- $id.ts                           # MODIFIED — pipeline.generateImageFor
`- script.ts                            # unchanged

tests/
|- fakes/
|   `- imagePipeline.ts                 # NEW — in-memory ports + createTestPipeline
|- helpers.ts                           # unchanged
`- ...

services/imagePipeline.ts                # DELETED
services/imagePipeline.test.ts           # DELETED (cases migrated to boundary suite)
```

**Structure Decision**: Promote `services/imagePipeline.ts` from a single file to a directory module (`services/imagePipeline/`) because the public surface grows from one method to three plus four ports plus four adapters. Keep `services/storyForge/` as the structural template (same lift was done in spec 005).

## Phase 0 / 1 outputs

See `research.md` (Phase 0), `data-model.md` (Phase 1 entities), `contracts/ports.md` (Phase 1 interface contracts), `quickstart.md` (Phase 1 verification walkthrough). Implementation tasks live in `tasks.md` (produced by `/speckit-tasks`).

## Complexity Tracking

> Constitution Check has no violations. This section is intentionally empty.
