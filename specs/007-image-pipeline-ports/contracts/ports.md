# Phase 1: Port Contracts — Image Pipeline

The pipeline depends on four ports. Each port is a TypeScript interface implemented by exactly two classes of adapter: a **production** adapter (in `services/imagePipeline/adapters/`) and an **in-memory** test fake (in `tests/fakes/imagePipeline.ts`).

## `AiTextPort`

```ts
import type { AIError, Result } from '@/services/storyForge/types' // existing module

interface AiTextPort {
  /**
   * Refines a free-text event description into an image-generation prompt.
   * Wraps `storyForge.imagePrompt(description)`.
   *
   * @returns
   *   - `{ ok: true, value: string }` — refined prompt ready for the image model.
   *   - `{ ok: false, error: AIError, message: string }` — model unavailable,
   *     unexpected response, content policy block, etc. Pipeline propagates this
   *     into the standard failure path with `cause = { kind: error }` so the DB
   *     `error` column carries the AIError discriminator.
   */
  imagePrompt(description: string): Promise<Result<string, AIError>>
}
```

**Production adapter**: `services/imagePipeline/adapters/aiText.ts` — single one-liner that delegates to `storyForge.imagePrompt`.

**In-memory adapter**: `tests/fakes/imagePipeline.ts::createInMemoryAiText({ result?, throws? })` — returns the configured `Result` or throws the configured error. Default: `{ ok: true, value: 'fake-prompt' }`.

## `AiImagePort`

```ts
interface AiImagePort {
  /**
   * Generates an image from a refined prompt. Wraps
   * `services/imageGen.ts::generateImageBase64`.
   *
   * @returns base64-encoded image payload (with or without the
   *   `data:image/png;base64,` prefix — the storage adapter strips it).
   * @throws Error preserving the underlying SDK error on `cause` so
   *   `causeToErrorString` can surface the inner message.
   */
  generateBase64(prompt: string): Promise<string>
}
```

**Production adapter**: `services/imagePipeline/adapters/aiImage.ts` — delegates to `generateImageBase64`.

**In-memory adapter**: `createInMemoryAiImage({ result?, throws? })` — returns the configured base64 or throws. Default: `{ result: 'iVBORw0KGgo=' }` (1-byte PNG header).

## `ImageStorePort`

```ts
interface ImageStorePort {
  /**
   * Persists generated image bytes for a given log id.
   * Production: uploads to R2 via `utils/cloudflare.ts::uploadToR2`.
   * The adapter MUST strip the optional `data:image/...;base64,` prefix and
   * convert base64 to bytes — the pipeline core never sees `Buffer` or base64.
   *
   * @param logId  Identifies the row whose image is being stored.
   * @param bytes  Raw image bytes.
   * @param contentType  Always `'image/png'` from the pipeline (FR-005b).
   */
  put(logId: number, bytes: Uint8Array, contentType: string): Promise<void>

  /**
   * Removes the stored image for a given log id. Wraps `deleteFromR2`.
   * Used by `DELETE /api/log/$id` (out of pipeline scope but the adapter
   * exposes it for the route to use directly through the singleton).
   */
  delete(logId: number): Promise<void>
}
```

**Production adapter**: `services/imagePipeline/adapters/imageStore.ts` — receives `Uint8Array` from the pipeline; the actual `Buffer.from(base64, 'base64')` happens in `aiImage.ts` to keep `imageStore` agnostic of the SDK encoding (re-evaluated below — we hand the conversion to `imageStore` because the AI port returns `string` and the store consumes bytes; the orchestrator sees `string -> Uint8Array` once via a small helper in `outcome.ts`). [See **Decision 5** in research.md.]

**In-memory adapter**: `createInMemoryImageStore()` — backs by `Map<number, { bytes: Uint8Array; contentType: string }>`. Exposes `.snapshot()` for test assertions.

## `LogRepositoryPort`

```ts
interface LogRepositoryPort {
  /**
   * Inserts a new log row with status = LogStatus.Created. Stamps
   * createdAt/updatedAt. Returns the generated id.
   */
  insertDraft(draft: DraftLog): Promise<{ id: number }>

  /**
   * Inserts (logId, categoryId) link rows. Trusts the caller's filter
   * — does NOT re-validate categoryId against the canonical category list.
   * No-op when `categoryIds` is empty.
   */
  linkCategories(logId: number, categoryIds: number[]): Promise<void>

  /**
   * Reads a single log row, projected to the pipeline's `LogRow` shape.
   * Returns `null` when no row matches.
   */
  findById(id: number): Promise<LogRow | null>

  /**
   * Returns the lowest-id row whose status is `Created`, or `null` when
   * the queue is empty. ORDER BY id ASC LIMIT 1 (FR-009a).
   */
  findFirstPending(): Promise<{ id: number } | null>

  /**
   * Reads the status column only. Returns `null` when no row matches.
   * Used by `generateImageFor` for the gate check; cheaper than `findById`.
   */
  loadStatus(id: number): Promise<{ status: LogStatus } | null>

  /**
   * Transitions status: Created -> ImageGenerated. Bumps updatedAt.
   * No-op (still resolves) if the row's status was already ImageGenerated
   * — but the pipeline gate prevents this normally.
   */
  markImageGenerated(id: number): Promise<void>

  /**
   * Transitions status: any -> Error. Persists `errorText` to the
   * `error` column. Bumps updatedAt.
   */
  markError(id: number, errorText: string): Promise<void>
}
```

**Production adapter**: `services/imagePipeline/adapters/logRepository.ts` — Drizzle queries against `log` and `logCategory`. `markError` MUST run `errorText` through `causeToErrorString` BEFORE calling, OR the adapter accepts `unknown` and applies `causeToErrorString` itself. (We choose: pipeline applies `causeToErrorString`; adapter receives a plain string. Keeps the `unknown` handling out of the I/O layer.)

**In-memory adapter**: `createInMemoryLogRepository({ initial?: LogRow[] })` — backs by `Map<number, LogRow & { categoryIds: number[]; error: string | null }>`. Auto-increments id. Exposes `.snapshot()` for assertions.

## Public pipeline interface

```ts
interface ImagePipeline {
  submit(input: SubmitInput): Promise<SubmitResult>
  generateImageFor(logId: number): Promise<PipelineOutcome>
  drainOnePending(): Promise<PipelineOutcome | null>
}

interface PipelineDeps {
  aiText: AiTextPort
  aiImage: AiImagePort
  store: ImageStorePort
  repo: LogRepositoryPort
}

declare const createImagePipeline: (deps: PipelineDeps) => ImagePipeline
declare const createDefaultImagePipeline: (overrides?: Partial<PipelineDeps>) => ImagePipeline
declare const pipeline: ImagePipeline   // singleton wired with production adapters
declare const logPipelineOutcome: (outcome: PipelineOutcome, contextLabel: string) => void
```

## Failure-mode contract (cross-port)

| Failure | Origin port | Pipeline path | Persisted state |
|---|---|---|---|
| `imagePrompt` returns `{ ok: false }` | AiTextPort | catch-block sets `cause = { kind: error }` | Error (with AIError discriminator on `cause`) |
| `generateBase64` throws | AiImagePort | catch-block sets `cause = error` | Error (with original message via `causeToErrorString`) |
| `store.put` throws | ImageStorePort | catch-block sets `cause = error` | Error |
| `markImageGenerated` throws (after successful upload) | LogRepositoryPort | catch-block sets `cause = error`; image is leaked in store | Error (or `failed-write-also-failed` if `markError` also throws) |
| `markError` throws | LogRepositoryPort | wrapped in inner try/catch | unchanged (status stays as it was); outcome `failed-write-also-failed` |
| `loadStatus` throws | LogRepositoryPort | NO_FAILURE path: best-effort `markError` on the assumed-existing row | Error (or `failed-write-also-failed`) |
| `insertDraft` throws | LogRepositoryPort | rejects to caller | (no row written) |
| `linkCategories` throws | LogRepositoryPort | row id captured; outer catch records the error against the new row | Error (row exists, status = Error) |
| `findFirstPending` throws | LogRepositoryPort | rejects to caller | (no progress); script's outer catch returns `{ success: false, error }` |
