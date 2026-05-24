import { LogStatus } from '@/data/enum/logStatus'
import { logger as defaultLogger, type Logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'
import type {
  EscalatorPort,
  ImagePipeline,
  PipelineDeps,
  PipelineReport,
  SubmitInput,
} from './ports'

// Internal 4-kind discriminator. Translated to `PipelineReport` at the
// boundary in `toReport` and never re-exported from the package barrel.
type PipelineOutcome =
  | { kind: 'success'; logId: number }
  | { kind: 'skipped'; logId: number; reason: 'not-found' | 'not-pending' }
  | { kind: 'failed-recorded'; logId: number; cause: unknown }
  | {
      kind: 'failed-write-also-failed'
      logId: number
      cause: unknown
      writeError: unknown
    }

// Sentinel for "no error yet". Using a unique symbol (not `undefined`)
// because a caller could legitimately `throw undefined` inside a port,
// which would otherwise be indistinguishable from "no failure" via a
// `cause === undefined` guard.
const NO_FAILURE: unique symbol = Symbol('NO_FAILURE')

/**
 * Resolve the human-readable error string we persist to `log.error`.
 * When the caller wraps an inner Error (the pattern used by
 * `services/imageGen.ts` and the storyForge.imagePrompt unwrap path),
 * prefer the inner cause message so the DB shows the real reason
 * (`"rate limit"`, `"content policy"`, ...) rather than the outer
 * wrapper (`"Image generation failed"`). FR-017.
 */
const causeToErrorString = (cause: unknown): string => {
  if (cause instanceof Error) {
    if (cause.cause instanceof Error && cause.cause.message) return cause.cause.message
    return cause.message
  }
  return JSON.stringify(cause)
}

// Decode the base64 image payload returned by AI image models. Workers
// expose a global `atob`; we keep this conversion in the orchestrator
// (out of the storage adapter) so swapping to a different store does
// not reinvent it. The `data:image/...;base64,` prefix from some
// providers is stripped here.
const decodeBase64 = (payload: string): Uint8Array => {
  const stripped = payload.replace(/^data:image\/\w+;base64,/, '')
  const binary = atob(stripped)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const runGeneration = async (deps: PipelineDeps, logId: number): Promise<void> => {
  const row = await deps.repo.findById(logId)
  if (!row) {
    throw new Error('Log not found')
  }

  let imagePrompt: string
  if (row.imageDescription) {
    imagePrompt = row.imageDescription
  } else {
    const result = await deps.aiText.imagePrompt(row.description)
    if (!result.ok) {
      // Preserve the AIError discriminator on `cause` so recordError
      // persists a meaningful classification.
      throw new Error(result.message || 'Image prompt generation failed', {
        cause: { kind: result.error },
      })
    }
    imagePrompt = result.value
  }

  const base64 = await deps.aiImage.generateBase64(imagePrompt)
  const bytes = decodeBase64(base64)

  await deps.store.put(logId, bytes)
  await deps.repo.markImageGenerated(logId)
}

const recordFailure = async (
  deps: PipelineDeps,
  logId: number,
  cause: unknown,
): Promise<PipelineOutcome> => {
  try {
    await deps.repo.markError(logId, causeToErrorString(cause))
    return { kind: 'failed-recorded', logId, cause }
  } catch (writeError) {
    return { kind: 'failed-write-also-failed', logId, cause, writeError }
  }
}

// Surface message bubbled up to HTTP callers. For Error causes we use the
// message verbatim so the trigger/$id and submit routes keep their
// pre-refactor "render the real reason" UX; non-Error causes collapse to a
// generic string (the structured value is still persisted to `log.error`
// via `causeToErrorString`).
const causeAsMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : 'Unknown error'

// Structured representation handed to the escalator's secondary write
// alert. Tries harder to surface non-Error causes than `causeAsMessage`.
const causeAsAlertString = (cause: unknown): string =>
  cause instanceof Error ? cause.message : JSON.stringify(cause)

/**
 * Translate an internal `PipelineOutcome` into the external
 * `PipelineReport`. Also performs the side-effects bound to each outcome
 * kind: logging every outcome and paging the escalator on the
 * write-also-failed branch.
 */
const handleOutcome = async (
  outcome: PipelineOutcome,
  log: Logger,
  escalator: EscalatorPort,
): Promise<PipelineReport> => {
  switch (outcome.kind) {
    case 'success':
      return { status: 'success', logId: outcome.logId }
    case 'skipped':
      log.info(`imagePipeline: skipped log ${outcome.logId} (${outcome.reason})`)
      return { status: 'skipped', logId: outcome.logId, reason: outcome.reason }
    case 'failed-recorded': {
      log.error(`imagePipeline: recorded an error for log ${outcome.logId}`, {
        cause: outcome.cause,
      })
      return {
        status: 'failed',
        logId: outcome.logId,
        message: causeAsMessage(outcome.cause),
      }
    }
    case 'failed-write-also-failed': {
      log.error(`imagePipeline: failed to write the error column for log ${outcome.logId}`, {
        cause: outcome.cause,
        writeError: outcome.writeError,
      })
      await escalator.alert({
        logId: outcome.logId,
        message: causeAsAlertString(outcome.cause),
        writeError: causeAsAlertString(outcome.writeError),
      })
      return {
        status: 'failed',
        logId: outcome.logId,
        message: causeAsMessage(outcome.cause),
      }
    }
    default:
      return assertNever(outcome)
  }
}

export const createImagePipeline = (deps: PipelineDeps): ImagePipeline => {
  const log: Logger = deps.logger ?? defaultLogger

  const runFor = async (logId: number): Promise<PipelineOutcome> => {
    let cause: unknown = NO_FAILURE
    let status: { status: LogStatus } | null = null

    try {
      status = await deps.repo.loadStatus(logId)
    } catch (error) {
      // loadStatus throwing means we cannot determine whether the row
      // exists or what state it's in. Best-effort: try to record the
      // error on the assumed-existing row; fall back to
      // failed-write-also-failed if that write also fails.
      cause = error
    }

    if (cause === NO_FAILURE) {
      if (!status) return { kind: 'skipped', logId, reason: 'not-found' }
      if (status.status !== LogStatus.Created) {
        return { kind: 'skipped', logId, reason: 'not-pending' }
      }

      try {
        await runGeneration(deps, logId)
        return { kind: 'success', logId }
      } catch (error) {
        cause = error
      }
    }

    return recordFailure(deps, logId, cause)
  }

  const generateImageFor = async (logId: number): Promise<PipelineReport> => {
    const outcome = await runFor(logId)
    return handleOutcome(outcome, log, deps.escalator)
  }

  const submit = async (input: SubmitInput): Promise<{ id: number; report: PipelineReport }> => {
    const { id } = await deps.repo.insertDraft(input.draft)

    let cause: unknown = NO_FAILURE
    try {
      await deps.repo.linkCategories(id, input.categoryIds)
    } catch (error) {
      cause = error
    }

    let outcome: PipelineOutcome
    if (cause === NO_FAILURE) {
      try {
        await runGeneration(deps, id)
        outcome = { kind: 'success', logId: id }
      } catch (error) {
        outcome = await recordFailure(deps, id, error)
      }
    } else {
      outcome = await recordFailure(deps, id, cause)
    }

    const report = await handleOutcome(outcome, log, deps.escalator)
    return { id, report }
  }

  const drain = async (): Promise<{ processed: number; failed: number }> => {
    let processed = 0
    let failed = 0
    while (true) {
      const row = await deps.repo.findFirstPending()
      if (!row) break
      const report = await generateImageFor(row.id)
      processed++
      if (report.status === 'failed') failed++
    }
    return { processed, failed }
  }

  return { submit, generateImageFor, drain }
}
