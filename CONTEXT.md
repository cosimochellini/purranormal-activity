# CONTEXT.md

Domain glossary. Reach for these terms when grepping, naming, or reading PR
diffs — they map 1:1 to module boundaries and to the public surfaces those
modules expose. If a new concept doesn't fit one of these terms, prefer adding
a new entry here over diluting an existing one.

## imagePipeline

The module that owns the image-generation state machine: prompt refinement,
image model call, R2 write, error recording on the `log` row, and Telegram
escalation when a secondary write fails after a primary failure. Delivery and
redelivery are Cloudflare Queues' job, not this module's — the pipeline decides
whether a failure *deserves* a retry and whether the budget is spent.

Public surface (see `services/imagePipeline/`):
- `submit({ draft, categoryIds })` — insert + link categories + enqueue. Never generates inline.
- `enqueue(logId, source)` — fire-and-forget queue write; returns `false` instead of throwing.
- `retry(logId)` — reset a row to `Created` with a fresh budget, then enqueue. Backs the operator endpoint.
- `generateImageFor(logId, ctx?)` — the work itself, called by the queue consumer.
- `enqueuePending(limit?)` — bounded batch enqueue of pending rows (replaces the old `drain()`).
- `sweep({ now?, limit? })` — cron reconciliation of stale `Created` rows.
- `abandon(logId, reason)` — force a pending row terminal; used by the dead-letter branch.
- `PipelineReport` — structured outcome; `retryable` tells the consumer whether to redeliver.
- `EscalatorPort` — injectable port for the "write-also-failed" alert.
- `QueuePort` — injectable port for the queue write, split factory/binding like `imageStore`.

## imageQueue

The `purranormal-image-jobs` queue and its dead-letter twin. `queue.ts` is the
binding-free factory (`createQueueProducer(getQueue)`);
`adapters/queue.server.ts` is the only module that touches `env.IMAGE_QUEUE`,
mirroring the `imageStore` / `r2.server` split. `consumer.ts` is the pure batch
handler: it claims, generates, and then acks or retries per message — never at
batch level. Message body is `{ v: 1, logId, source }`; an unreadable body is
acked, never retried.

## claim

The atomic lease on one generation attempt:
`UPDATE log SET attempts = attempts + 1, updated_at = ? WHERE id = ? AND status
= 'Created' AND attempts < ? RETURNING attempts`. A plain status read would let
two deliveries of the same `logId` both pay for an image; the conditional
update makes the budget enforceable and, by bumping `updated_at`, renews the
staleness lease the sweeper reads.

## sweeper

The 5-minute cron reconciliation (`imagePipeline.sweep`). A `Created` row whose
`updated_at` is older than `SWEEP_STALE_MS` is presumed lost: re-enqueued if it
still has budget, marked `Error` if it does not. `touchPending` renews the
lease after each re-enqueue so the next tick does not duplicate a message that
is still in flight.

## imageStore

The R2-backed object store. Replaces the fragmented `utils/cloudflare.ts` +
`instances/s3.ts` pair that pre-dated sub-#3.

Split along the client/server boundary, because `start/routeTree.gen.ts`
statically imports every API route and would otherwise drag the R2 binding into
the browser bundle:

- `@/services/imageStore` — **client-safe**, no binding, no secrets.
  - `objectKey(id)` — the `<id>/cover.webp` key scheme, single source of truth.
  - `publicUrl(id)` — canonical R2 read URL (empty string when the public host
    is unset).
- `@/services/imageStore/r2` — `createR2ImageStore(getBucket)`, the pure write
  factory. Tests call it with a fake bucket.
- `@/services/imageStore/r2.server` — **server-only** (`.server.ts` triggers
  TanStack Start's client import protection; see `vite.config.mts`). Wires the
  factory to the `IMAGES` R2 binding and exports `imageStore`.
  - `put(id, bytes)` — write the cover for a log id.
  - `delete(id)` — remove the cover.

## escalator

The port through which `imagePipeline` notifies operators when a secondary
write fails after a primary failure has already been recorded. Pipeline core
stays presentation-free; adapters own the channel + formatting.

Two adapters live in `services/imagePipeline/adapters/`:
- `telegramEscalator` — production fan-out to every configured Telegram chat.
- `noopEscalator` — test-only sink that records calls without sending.
