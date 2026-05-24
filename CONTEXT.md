# CONTEXT.md

Domain glossary. Reach for these terms when grepping, naming, or reading PR
diffs — they map 1:1 to module boundaries and to the public surfaces those
modules expose. If a new concept doesn't fit one of these terms, prefer adding
a new entry here over diluting an existing one.

## imagePipeline

The deepened module that owns image generation end-to-end: prompt refinement,
DALL-E call, R2 write, retry, error recording on the `log` row, and Telegram
escalation when a secondary write fails after a primary failure.

Public surface (see `services/imagePipeline/`):
- `submit({ draft, categoryIds })` — insert + kick off generation.
- `generateImageFor(logId)` — regenerate an existing log's image.
- `drain()` — batch-process logs still in `Created` status.
- `PipelineReport` — structured outcome returned from every entry point.
- `EscalatorPort` — injectable port for the "write-also-failed" alert.

## imageStore

The R2-backed object store. Replaces the fragmented `utils/cloudflare.ts` +
`instances/s3.ts` pair that pre-dated sub-#3.

Public surface (see `services/imageStore/`):
- `put(id, bytes)` — write the cover for a log id.
- `delete(id)` — remove the cover.
- `publicUrl(id)` — canonical R2 URL (empty string when public URL unset).

## escalator

The port through which `imagePipeline` notifies operators when a secondary
write fails after a primary failure has already been recorded. Pipeline core
stays presentation-free; adapters own the channel + formatting.

Two adapters live in `services/imagePipeline/adapters/`:
- `telegramEscalator` — production fan-out to every configured Telegram chat.
- `noopEscalator` — test-only sink that records calls without sending.
