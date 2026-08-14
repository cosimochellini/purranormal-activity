import { LogStatus } from '@/data/enum/logStatus'
import { logger as defaultLogger, type Logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'
import {
  ENQUEUE_PENDING_LIMIT,
  MAX_ATTEMPTS,
  MAX_DELIVERIES,
  SWEEP_LIMIT,
  SWEEP_STALE_MS,
} from './config'
import type {
  AttemptContext,
  EnqueueSource,
  EscalatorPort,
  ImagePipeline,
  PipelineDeps,
  PipelineReport,
  SubmitInput,
  SubmitResult,
  SweepSummary,
} from './ports'

// Internal 5-kind discriminator. Translated to `PipelineReport` at the
// boundary in `handleOutcome` and never re-exported from the package barrel.
type PipelineOutcome =
  | { kind: 'success'; logId: number }
  | { kind: 'skipped'; logId: number; reason: 'not-found' | 'not-pending' | 'superseded' }
  | { kind: 'failed-recorded'; logId: number; cause: unknown }
  | { kind: 'failed-retryable'; logId: number; cause: unknown; attempt: number }
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

// HTTP statuses that mean "this input will never work". Retrying them buys a
// second identical failure and a second bill.
const NON_RETRYABLE_STATUS = new Set([400, 403, 404, 422])

// Provider prose for moderation-style rejections. gpt-image-2 refusals arrive
// as prose, not as a machine-readable code, so a text probe is the only signal
// available at this seam.
const NON_RETRYABLE_TEXT = /content[\s_-]?policy|moderation|safety system|invalid[\s_-]?prompt/i

const readStatus = (value: unknown): number | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of ['status', 'statusCode']) {
    const raw = record[key]
    if (typeof raw === 'number') return raw
  }
  return undefined
}

/**
 * Should this failure get its second attempt?
 *
 * The retry budget only pays for itself on transient faults (rate limits,
 * 5xx, network blips, R2 hiccups). Deterministic rejections — a moderation
 * refusal, a validation failure from storyForge, a row that no longer
 * exists — fail identically on the retry, so we spend the budget only when
 * there is something to gain. Anything unrecognised is treated as transient:
 * a wasted retry is cheaper than a permanently-wrong `Error` row.
 */
const isRetryable = (cause: unknown): boolean => {
  if (!(cause instanceof Error)) return true

  // Thrown by `runGeneration` when the row vanished between claim and read.
  if (cause.message === 'Log not found') return false

  const inner = cause.cause

  // storyForge failures are wrapped as `{ cause: { kind: AIError } }`; the
  // `validation` discriminator means the model returned unusable output for
  // this exact prompt.
  if (inner && typeof inner === 'object' && 'kind' in inner) {
    if ((inner as { kind: unknown }).kind === 'validation') return false
  }

  const prose = [cause.message, inner instanceof Error ? inner.message : ''].join(' ')
  if (NON_RETRYABLE_TEXT.test(prose)) return false

  const status = readStatus(inner) ?? readStatus(cause)
  if (status !== undefined && NON_RETRYABLE_STATUS.has(status)) return false

  return true
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

/**
 * Returns `false` when the generation succeeded but a newer cycle had already
 * started (an edit or an operator retry reset `attempts`), so the fenced write
 * did not land and the result must be discarded rather than published.
 */
const runGeneration = async (
  deps: PipelineDeps,
  logId: number,
  forAttempt: number,
): Promise<boolean> => {
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
  return deps.repo.markImageGenerated(logId, forAttempt)
}

/**
 * Record a failure at the right severity.
 *
 * A non-final failure writes NOTHING: `repo.claim` already incremented
 * `attempts` and bumped `updatedAt` (the sweeper lease), and leaving the row
 * in `Created` is what lets the redelivered message claim its second attempt.
 * Writing `error` here would also make the row read as "failed" while the UI
 * still renders it as "generating".
 */
const recordFailure = async (
  deps: PipelineDeps,
  logId: number,
  cause: unknown,
  opts: { final: boolean; attempt: number; forAttempt?: number },
): Promise<PipelineOutcome> => {
  if (!opts.final) {
    return { kind: 'failed-retryable', logId, cause, attempt: opts.attempt }
  }
  try {
    const applied = await deps.repo.markError(logId, causeToErrorString(cause), opts.forAttempt)
    // The write found no row to terminate: this failure belongs to a cycle that
    // is over — the row was edited (so a newer cycle owns it and parking it in
    // `Error` would deny that cycle its image), resolved, or deleted outright.
    if (!applied) return { kind: 'skipped', logId, reason: 'not-pending' }
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
    case 'failed-retryable': {
      log.warn(
        `imagePipeline: attempt ${outcome.attempt}/${MAX_ATTEMPTS} failed for log ${outcome.logId}, leaving it pending for redelivery`,
        { cause: outcome.cause },
      )
      return {
        status: 'failed',
        logId: outcome.logId,
        message: causeAsMessage(outcome.cause),
        retryable: true,
      }
    }
    case 'failed-recorded': {
      log.error(`imagePipeline: recorded an error for log ${outcome.logId}`, {
        cause: outcome.cause,
      })
      return {
        status: 'failed',
        logId: outcome.logId,
        message: causeAsMessage(outcome.cause),
        retryable: false,
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
        retryable: false,
      }
    }
    default:
      return assertNever(outcome)
  }
}

export const createImagePipeline = (deps: PipelineDeps): ImagePipeline => {
  const log: Logger = deps.logger ?? defaultLogger

  /**
   * `repo.claim` returned no row. Work out why, so the caller gets an
   * honest report and a budget-exhausted row does not sit in `Created`
   * forever waiting for a sweeper that would only re-enqueue it.
   */
  const diagnoseUnclaimed = async (logId: number): Promise<PipelineOutcome> => {
    let state: Awaited<ReturnType<typeof deps.repo.loadState>> = null
    try {
      state = await deps.repo.loadState(logId)
    } catch (error) {
      log.error(`imagePipeline: could not read state for unclaimed log ${logId}`, { error })
      // Report it as a skip so the message is acked; the row (if it is still
      // pending) stays visible to the sweeper.
      return { kind: 'skipped', logId, reason: 'not-pending' }
    }

    if (!state) return { kind: 'skipped', logId, reason: 'not-found' }
    if (state.status !== LogStatus.Created) {
      return { kind: 'skipped', logId, reason: 'not-pending' }
    }

    // Still pending, so the claim was refused for the only remaining reason:
    // the attempt budget is spent. Make it terminal now.
    return recordFailure(
      deps,
      logId,
      new Error(`Image generation gave up after ${MAX_ATTEMPTS} attempts`),
      { final: true, attempt: state.attempts },
    )
  }

  const runFor = async (logId: number, ctx?: AttemptContext): Promise<PipelineOutcome> => {
    let claim: { attempt: number } | null = null
    let claimError: unknown = NO_FAILURE

    try {
      claim = await deps.repo.claim(logId, MAX_ATTEMPTS)
    } catch (error) {
      claimError = error
    }

    if (claimError !== NO_FAILURE) {
      // We cannot tell whether the row exists or how much budget is left, so
      // treat this as terminal rather than granting unbounded redeliveries.
      return recordFailure(deps, logId, claimError, { final: true, attempt: MAX_ATTEMPTS })
    }

    if (!claim) return diagnoseUnclaimed(logId)

    try {
      const published = await runGeneration(deps, logId, claim.attempt)
      if (!published) return { kind: 'skipped', logId, reason: 'superseded' }
      return { kind: 'success', logId }
    } catch (cause) {
      const budgetSpent =
        claim.attempt >= MAX_ATTEMPTS || (ctx?.deliveryAttempt ?? 1) >= MAX_DELIVERIES
      const final = ctx?.final === true || budgetSpent || !isRetryable(cause)
      return recordFailure(deps, logId, cause, {
        final,
        attempt: claim.attempt,
        forAttempt: claim.attempt,
      })
    }
  }

  const generateImageFor = async (logId: number, ctx?: AttemptContext): Promise<PipelineReport> => {
    const outcome = await runFor(logId, ctx)
    return handleOutcome(outcome, log, deps.escalator)
  }

  const enqueue = async (logId: number, source: EnqueueSource): Promise<boolean> => {
    try {
      await deps.queue.send({ v: 1, logId, source })
      return true
    } catch (error) {
      // Never throws: the row is already persisted as `Created`, so the cron
      // sweeper is the recovery path and the caller's own work stands.
      log.error(`imagePipeline: enqueue failed for log ${logId}`, { error, source })
      return false
    }
  }

  const retry: ImagePipeline['retry'] = async (logId) => {
    const row = await deps.repo.requeueForRetry(logId)
    if (!row) return { requeued: false, enqueued: false }
    return { requeued: true, enqueued: await enqueue(logId, 'retry') }
  }

  const submit = async (input: SubmitInput): Promise<SubmitResult> => {
    const { id } = await deps.repo.insertDraft(input.draft)

    try {
      await deps.repo.linkCategories(id, input.categoryIds)
    } catch (error) {
      // Preserve the pre-queue semantics: a half-written row is recorded as
      // failed rather than silently queued for generation.
      const outcome = await recordFailure(deps, id, error, { final: true, attempt: 0 })
      const report = await handleOutcome(outcome, log, deps.escalator)
      return { id, enqueued: false, message: report.message }
    }

    const enqueued = await enqueue(id, 'submit')
    return enqueued
      ? { id, enqueued: true }
      : { id, enqueued: false, message: 'Failed to enqueue image generation' }
  }

  const enqueuePending = async (limit = ENQUEUE_PENDING_LIMIT): Promise<{ processed: number }> => {
    const rows = await deps.repo.findPending(limit)
    if (rows.length === 0) return { processed: 0 }

    const ids = rows.map(({ id }) => id)
    // Send before touching: a failed send leaves the lease short so the
    // sweeper picks the rows up soon, whereas a failed touch only risks a
    // harmless duplicate enqueue (bounded by the attempt budget).
    await deps.queue.sendBatch(ids.map((logId) => ({ v: 1 as const, logId, source: 'script' })))
    await deps.repo.touchPending(ids)
    return { processed: ids.length }
  }

  const abandon = async (logId: number, reason: string): Promise<PipelineReport> => {
    let state: Awaited<ReturnType<typeof deps.repo.loadState>> = null
    try {
      state = await deps.repo.loadState(logId)
    } catch (error) {
      log.error(`imagePipeline: could not read state before abandoning log ${logId}`, { error })
    }

    // A late dead-letter hop must never clobber a row that succeeded in the
    // meantime, nor overwrite an already-recorded error.
    if (state && state.status !== LogStatus.Created) {
      return handleOutcome({ kind: 'skipped', logId, reason: 'not-pending' }, log, deps.escalator)
    }

    const outcome = await recordFailure(deps, logId, new Error(reason), {
      final: true,
      attempt: state?.attempts ?? MAX_ATTEMPTS,
    })
    return handleOutcome(outcome, log, deps.escalator)
  }

  const sweep = async (options?: { now?: number; limit?: number }): Promise<SweepSummary> => {
    const cutoff = (options?.now ?? Date.now()) - SWEEP_STALE_MS
    const rows = await deps.repo.findStalePending({ cutoff, limit: options?.limit ?? SWEEP_LIMIT })

    const exhausted = rows.filter((row) => row.attempts >= MAX_ATTEMPTS)
    const retryable = rows.filter((row) => row.attempts < MAX_ATTEMPTS)

    let abandoned = 0
    for (const row of exhausted) {
      const report = await abandon(
        row.id,
        `Image generation gave up after ${MAX_ATTEMPTS} attempts`,
      )
      if (report.status === 'failed') abandoned++
    }

    let requeued = 0
    let failed = 0
    if (retryable.length > 0) {
      const ids = retryable.map((row) => row.id)
      try {
        await deps.queue.sendBatch(
          ids.map((logId) => ({ v: 1 as const, logId, source: 'sweeper' })),
        )
        // Renewing the lease is what stops the next tick from re-enqueueing
        // rows whose message is still in flight.
        await deps.repo.touchPending(ids)
        requeued = ids.length
      } catch (error) {
        log.error('imagePipeline: sweep re-enqueue failed', { error })
        failed = ids.length
      }
    }

    log.info(
      `imagePipeline: sweep scanned=${rows.length} requeued=${requeued} abandoned=${abandoned} failed=${failed}`,
    )
    return { scanned: rows.length, requeued, abandoned, failed }
  }

  return { submit, enqueue, retry, generateImageFor, enqueuePending, sweep, abandon }
}
