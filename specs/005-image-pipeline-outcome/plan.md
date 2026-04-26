# Implementation Plan: `imagePipeline.run()` with Discriminated `PipelineOutcome`

**Branch**: `005-image-pipeline-outcome` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-image-pipeline-outcome/spec.md`

## Summary

Introduce a deep `ImagePipeline` module at `services/imagePipeline.ts`
that owns the load-status-then-act sequence and emits a 4-variant
discriminated `PipelineOutcome` union. Migrate the three entry points
(submit, edit-PUT, individual trigger) plus the batch driver to call
`pipeline.run(logId)` and `switch` exhaustively on the outcome. Delete
`services/content.ts`, `services/trigger.ts`, and the `setLogError`
public export from `services/log.ts`. Activate the dormant
`LogStatus.Error` value via the default-deps `recordError`. Wire a
loud Telegram fan-out on `failed-write-also-failed` from the batch driver.
Single PR to `main` from branch `005-image-pipeline-outcome`.

## Technical Context

**Language/Version**: TypeScript 6.x (strict mode), Node 22.12+.
**Primary Dependencies**: TanStack Start 1.162, Drizzle 0.45, Vitest 4.1,
Biome 2.4, Wrangler 4.85. No new deps.
**Storage**: Turso (SQLite, HTTP via `drizzle-orm/libsql/web`) — pipeline
issues a single `update` per recorded error.
**Testing**: Vitest with `node` environment for services. Boundary suite
uses pure callback substitution — no `vi.mock` for `@/drizzle`,
`@/services/ai`, or `@/utils/cloudflare`. Default-deps assertions reuse
`tests/helpers.ts` `makeFakeDb`.
**Target Platform**: Cloudflare Workers (production); Node 22 (CI).
**Project Type**: web app (frontend + serverless backend).
**Performance Goals**: pipeline overhead is one extra `select status`
round-trip vs the legacy code (which already did the same lookup inside
`triggerLogImageIfPending`). Net cost: zero new round-trips.
**Constraints**: deterministic tests; no real network; no real DB.
**Scale/Scope**: ~150 LOC of new code (`imagePipeline.ts` + boundary
test), ~250 LOC removed (`content.ts`, `trigger.ts`, their tests, the
`setLogError` block in `log.ts` + its tests, and the no-op
`regenerateContents({ triggerImages: false })` call in DELETE).

## Constitution Check

*Gate: must pass before Phase 0; re-check after design.*

The repo's constitution is empty (`memory/` directory has no constitution
file). No specific gates to evaluate; the implementation honors the
project's existing conventions documented in `CLAUDE.md`:

- Arrow functions ✓ (factory + dep wrappers)
- Interfaces over type aliases ✓ (`ImagePipeline`, `PipelineDeps`)
- Discriminated unions over enums for tagged data ✓ (`PipelineOutcome`)
- Path alias `@/*` ✓
- Biome (single quotes, no semicolons, 100-char width) ✓ — will run
  `pnpm lint:fix` before commit.
- Named exports ✓
- No new Maps required (no enum-replacement opportunity here).

## Architecture

### New module: `services/imagePipeline.ts`

```ts
export type PipelineOutcome =
  | { kind: 'success'; logId: number }
  | { kind: 'skipped'; logId: number; reason: 'not-found' | 'not-pending' }
  | { kind: 'failed-recorded'; logId: number; cause: unknown }
  | { kind: 'failed-write-also-failed'; logId: number; cause: unknown; writeError: unknown }

export interface PipelineDeps {
  loadStatus: (id: number) => Promise<{ status: LogStatus } | null>
  generate: (id: number) => Promise<void>
  markGenerated: (id: number) => Promise<void>
  recordError: (id: number, cause: unknown) => Promise<void>  // permitted to throw
}

export interface ImagePipeline {
  run: (logId: number) => Promise<PipelineOutcome>
}

export const createImagePipeline: (deps: PipelineDeps) => ImagePipeline
export const createDefaultImagePipeline: (overrides?: Partial<PipelineDeps>) => ImagePipeline
export const imagePipeline: ImagePipeline
```

`run(logId)` algorithm:

```
status = await deps.loadStatus(logId)
if (!status)                              return { kind:'skipped', reason:'not-found' }
if (status.status !== Created)            return { kind:'skipped', reason:'not-pending' }
try {
  await deps.generate(logId)
  await deps.markGenerated(logId)
  return { kind:'success' }
} catch (cause) {
  try { await deps.recordError(logId, cause); return { kind:'failed-recorded', cause } }
  catch (writeError)                      { return { kind:'failed-write-also-failed', cause, writeError } }
}
```

### Default deps wiring

| Dep | Implementation |
| --- | --- |
| `loadStatus`  | Inline `db.select({ status }).from(log).where(eq(log.id,id))` — same shape as legacy `triggerLogImageIfPending`'s lookup |
| `generate`    | Inlined body of legacy `generateLogImage` (lookup row → reuse cached imageDescription or call `generateImagePrompt` → `generateImageBase64` → `uploadToR2`). Throws `Error('Log not found')` if the row vanished between `loadStatus` and `generate`. |
| `markGenerated` | `db.update(log).set({ status: ImageGenerated }).where(eq(log.id,id))` |
| `recordError` | `db.update(log).set({ status: Error, error: <msg> }).where(eq(log.id,id))` — single update; re-throws on failure |

### Caller migration

| Caller | Before | After |
| --- | --- | --- |
| `start/routes/api/log/submit.ts:81` | `regenerateContents({ triggerLogId: newLog.id })` | `await imagePipeline.run(newLog.id)` |
| `start/routes/api/log/$id.ts:122` (PUT) | `regenerateContents({ triggerImages: …Created, triggerLogId: updated.id })` | `await imagePipeline.run(updated.id)` (pipeline's own `not-pending` skip handles the gating) |
| `start/routes/api/log/$id.ts:165` (DELETE) | `regenerateContents({ triggerImages: false })` | **delete the line** — was already a no-op |
| `start/routes/api/trigger/$id.ts:22` | direct `generateLogImage` + `setLogError` catch | `pipeline.run(logId)` + exhaustive `switch`; preserve `X-Invalidate: log:<id>` |
| `services/script.ts:16` (batch) | `generateLogImage(id)` swallowed in try/catch | `pipeline.run(id)` + on `failed-write-also-failed` fan-out Telegram alert via `sendMessage(chatId, text)` for every `TELEGRAM_BOT_CHAT_IDS`; per-chat send failures logged but not propagated |

### Telegram fan-out on `failed-write-also-failed`

Reuses `sendMessage` from `services/telegram` directly. The existing
`services/notifier` module is event-card oriented (composes from a
`LogWithCategories` and posts both text+photo) — wrong shape for a
sysop alert. `sendMessage` is the right primitive:

```
🚨 Image pipeline write-also-failed
logId: <id>
cause: <message>
writeError: <message>
```

Per-chat sends are wrapped in try/catch — a chat that's misconfigured
should NOT prevent the alert from reaching the others.

## Files to add / modify / delete

### Add
- `services/imagePipeline.ts` (factory + interfaces + default deps).
- `services/imagePipeline.test.ts` (boundary suite + default-recordError assertions).

### Modify
- `start/routes/api/log/submit.ts` (replace `regenerateContents`).
- `start/routes/api/log/$id.ts` (PUT replace; DELETE remove no-op).
- `start/routes/api/trigger/$id.ts` (rewrite handler).
- `services/script.ts` (batch driver) — adds Telegram alert path.
- `services/log.ts` — remove `setLogError` export and its `logger` import.
- `services/log.test.ts` — remove the entire `describe('setLogError')` block (and the now-unused logger / setLogError imports).
- `tests/api/log.submit.test.ts` (mock pipeline.run instead of regenerateContents).
- `tests/api/log.$id.test.ts` (mock pipeline.run; drop DELETE → regenerateContents references).
- `tests/api/trigger.$id.test.ts` (mock pipeline.run; drop generateLogImage + setLogError).
- `services/script.test.ts` (mock pipeline.run; assert alert fan-out on failed-write-also-failed).

### Delete
- `services/content.ts`
- `services/content.test.ts`
- `services/trigger.ts`
- `services/trigger.test.ts`

## Verification

| Gate | Command | Pass criterion |
| --- | --- | --- |
| Lint | `pnpm lint` | Zero diagnostics |
| Types | `pnpm typecheck` | Clean compile |
| Tests | `pnpm test` | All suites green; coverage ≥ 50% |
| Build | `pnpm build` | `dist/` produced without errors |

## PR + iteration

1. Push `005-image-pipeline-outcome` to `origin`.
2. `gh pr create` with a body that lists each `PipelineOutcome` variant
   and the four entry-point migrations.
3. Run `/gh-pr-no-checkout-review` from a fresh opus subagent (zero
   context). Fix every P0/P1/P2 finding in the worktree, re-run all four
   gates, commit, push, repeat. Loop terminates only when one review pass
   returns zero P0/P1/P2.

## Risk & mitigations

- **Status drift**: a row could move out of `Created` between `loadStatus`
  and `generate`. Mitigation: `generate` re-reads the row and still throws
  `Log not found` if it vanished; the pipeline emits `failed-recorded`.
  Acceptable — same as legacy behavior.
- **Image uploaded but `markGenerated` write fails**: the bucket has the
  image, the row has status=Error. Acceptable — operator sees the error,
  manual repair flips status back to `ImageGenerated`. Frequency:
  vanishingly low; the same pattern existed in legacy code.
- **Telegram fan-out blocking the batch**: each per-chat send is awaited
  inside `Promise.all`; on a 5-chat fan-out worst case is ~5s. The
  whole batch already inserts a 5s delay between groups, so this is
  within the existing wall-clock budget.
