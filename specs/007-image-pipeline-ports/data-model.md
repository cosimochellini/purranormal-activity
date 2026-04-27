# Phase 1: Data Model — Image Pipeline Ports & Adapters

The pipeline does not introduce new database tables or new columns. It re-types existing rows behind ports.

## Existing entities (Drizzle schema, unchanged)

### `log` (Drizzle table `log`)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | no | PK; auto-increment. `findFirstPending` orders by `id ASC`. |
| `title` | TEXT | no | Set at insert time from `storyForge.logDetails`. |
| `description` | TEXT | no | Set at insert time. |
| `imageDescription` | TEXT | yes | Set at insert time when storyForge produces one; nullable means "ask the AI text port for one at generation time". |
| `status` | TEXT | no | One of `LogStatus.Created`, `LogStatus.ImageGenerated`, `LogStatus.Error`. The pipeline owns transitions out of `Created`. |
| `error` | TEXT | yes | Persisted by `recordError` via `causeToErrorString`. Cleared on a successful re-run? No — current behaviour does not clear; preserved. |
| `createdAt` | INTEGER | no | epoch ms; set at insert. |
| `updatedAt` | INTEGER | no | epoch ms; bumped on any write. |

### `log_category` (Drizzle table `logCategory`)

| Column | Type | Notes |
|---|---|---|
| `logId` | INTEGER | FK → `log.id` (cascade delete). |
| `categoryId` | INTEGER | FK → `category.id`. |

### `category` — unchanged. Only read by `storyForge` (out of scope).

## Pipeline-internal types (TypeScript, new)

### `LogStatus` — re-exported, unchanged

```ts
import { LogStatus } from '@/data/enum/logStatus'
// 'Created' | 'ImageGenerated' | 'Error'
```

### `LogRow` (port-level projection of `log` row)

```ts
interface LogRow {
  id: number
  description: string
  imageDescription: string | null
  status: LogStatus
}
```

> Note: `title`, `error`, `createdAt`, `updatedAt` are NOT projected because the pipeline never reads them. The repository adapter still writes them.

### `DraftLog` (input to `LogRepositoryPort.insertDraft`)

```ts
interface DraftLog {
  title: string
  description: string
  imageDescription: string | null
}
```

> Status is set to `LogStatus.Created` by the adapter (not by the caller). `createdAt`/`updatedAt` are stamped by the adapter. The pipeline trusts inputs.

### `SubmitInput` (input to `pipeline.submit`)

```ts
interface SubmitInput {
  draft: DraftLog
  categoryIds: number[]   // already filtered against allCategoryIds at the call-site
}
```

### `PipelineOutcome` (preserved verbatim from spec 005)

```ts
type PipelineOutcome =
  | { kind: 'success'; logId: number }
  | { kind: 'skipped'; logId: number; reason: 'not-found' | 'not-pending' }
  | { kind: 'failed-recorded'; logId: number; cause: unknown }
  | { kind: 'failed-write-also-failed'; logId: number; cause: unknown; writeError: unknown }
```

### `SubmitResult`

```ts
interface SubmitResult {
  id: number
  outcome: PipelineOutcome
}
```

## State machine

```text
                     submit(input)
                          │
                          ▼
                 insertDraft → linkCategories
                          │ throws? → goto recordError path
                          ▼
                       Created
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        │           generateImageFor      drainOnePending
        │                 │                  │
        │                 ▼                  ▼
        │         loadStatus(id)       findFirstPending
        │                 │                  │ null? → return null
        │                 ▼                  ▼
        │           (gate: Created)    (loop into generateImageFor)
        │                 │
        │                 ▼
        │           imagePrompt? (when imageDescription is null)
        │                 │
        │                 ▼
        │           generateBase64
        │                 │
        │                 ▼
        │           store.put
        │                 │
        │                 ▼
        │           markImageGenerated
        │                 │
        │                 ▼
        │             ImageGenerated   ◄── terminal (success outcome)
        │
        └──── (any failure above) ───►  recordError ──► Error / failed-recorded
                                              │
                                              └─── recordError fails ─► failed-write-also-failed
                                                                         (status stays Created)
```

## Outcome semantics matrix

| Caller path              | Pre-state         | Failure point                  | Final state         | Outcome                          |
|---|---|---|---|---|
| submit                   | (no row)          | (none)                         | ImageGenerated      | success                          |
| submit                   | (no row)          | linkCategories throws          | Error               | failed-recorded                  |
| submit                   | (no row)          | generateBase64 throws          | Error               | failed-recorded                  |
| submit                   | (no row)          | gen + recordError both fail    | Created             | failed-write-also-failed         |
| generateImageFor         | Created           | (none)                         | ImageGenerated      | success                          |
| generateImageFor         | Created           | image step throws              | Error               | failed-recorded                  |
| generateImageFor         | Created           | gen + recordError both fail    | Created             | failed-write-also-failed         |
| generateImageFor         | ImageGenerated/Error | n/a                          | unchanged           | skipped/not-pending              |
| generateImageFor         | (no row)          | n/a                            | n/a                 | skipped/not-found                |
| generateImageFor         | unknown (loadStatus throws) | best-effort recordError | Error (or unchanged) | failed-recorded or failed-write-also-failed |
| drainOnePending          | (no Created rows) | n/a                            | n/a                 | null (return)                    |
| drainOnePending          | Created           | (any of the above)             | (any of the above)  | (the wrapped generateImageFor outcome) |

## Invariants

- Only `LogRepositoryPort.markImageGenerated` writes status `ImageGenerated`.
- Only `LogRepositoryPort.markError` writes status `Error` (and `error` column).
- `submit` is the only public path that ever calls `insertDraft`.
- `drainOnePending` calls `findFirstPending` exactly once per invocation (no retry).
- `generateImageFor` calls `loadStatus` exactly once per invocation; the rest of the orchestration runs only if the gate matches.
