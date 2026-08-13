import type { LogStatus } from '@/data/enum/logStatus'
import type { AIResult } from '@/services/storyForge'
import type { Logger } from '@/utils/logger'

export interface DraftLog {
  title: string
  description: string
  imageDescription: string | null
}

export interface LogRow {
  id: number
  description: string
  imageDescription: string | null
  status: LogStatus
}

export interface SubmitInput {
  draft: DraftLog
  categoryIds: number[]
}

/** Who asked for a generation. Diagnostics only — never branched on. */
export type EnqueueSource = 'submit' | 'update' | 'retry' | 'script' | 'sweeper'

/**
 * Queue message body. `v` is a version tag: the consumer rejects (and acks)
 * anything it does not recognise instead of retrying a shape it cannot read.
 */
export interface ImageJob {
  v: 1
  logId: number
  source: EnqueueSource
}

/**
 * External-facing pipeline result. Collapses the internal `PipelineOutcome`
 * discriminator (success | skipped | failed-recorded | failed-retryable |
 * failed-write-also-failed) into a 3-kind status. The internal "secondary
 * write also failed" branch is escalated via `EscalatorPort` and surfaces
 * here as a plain `status: 'failed'`.
 */
export interface PipelineReport {
  status: 'success' | 'skipped' | 'failed'
  logId: number
  /** Present iff `status === 'skipped'`. */
  reason?: 'not-found' | 'not-pending'
  /** Present iff `status === 'failed'`. */
  message?: string
  /**
   * Present iff `status === 'failed'`. `true` means the row was deliberately
   * left in `Created` and the caller should redeliver the message; `false`
   * means the row is now `Error` and redelivery would only be skipped as
   * `not-pending`.
   */
  retryable?: boolean
}

export interface SubmitResult {
  id: number
  /** `false` when the row was saved but the queue write failed. */
  enqueued: boolean
  /** Present iff `!enqueued`. */
  message?: string
}

export interface SweepSummary {
  scanned: number
  requeued: number
  abandoned: number
  failed: number
}

/**
 * Per-delivery context handed to `generateImageFor` by the queue consumer.
 * A direct caller omits it and gets the durable budget from `repo.claim`.
 */
export interface AttemptContext {
  /** 1-based per-MESSAGE counter, i.e. `Message.attempts`. */
  deliveryAttempt?: number
  /** Force terminal handling regardless of the remaining budget. */
  final?: boolean
}

export interface AiTextPort {
  imagePrompt(description: string): Promise<AIResult<string>>
}

export interface AiImagePort {
  generateBase64(prompt: string): Promise<string>
}

export interface ImageStorePort {
  put(logId: number, bytes: Uint8Array): Promise<void>
  delete(logId: number): Promise<void>
}

export interface QueuePort {
  send(job: ImageJob): Promise<void>
  sendBatch(jobs: readonly ImageJob[]): Promise<void>
}

export interface PendingRow {
  id: number
  attempts: number
}

export interface LogRepositoryPort {
  insertDraft(draft: DraftLog): Promise<{ id: number }>
  linkCategories(logId: number, categoryIds: number[]): Promise<void>
  findById(id: number): Promise<LogRow | null>
  findPending(limit: number): Promise<{ id: number }[]>
  findStalePending(opts: { cutoff: number; limit: number }): Promise<PendingRow[]>
  loadState(id: number): Promise<{ status: LogStatus; attempts: number } | null>
  /**
   * Atomically take ownership of one generation attempt. Returns the 1-based
   * attempt number, or `null` when the row is absent, no longer `Created`, or
   * has already spent its `maxAttempts` budget.
   *
   * This is a lease, not a read: `loadState` would let two concurrent
   * deliveries of the same `logId` both pass a status check and both pay for
   * an image. The single conditional `UPDATE ... RETURNING` makes the budget
   * enforceable, and bumping `updatedAt` in the same statement renews the
   * staleness lease the sweeper reads.
   */
  claim(id: number, maxAttempts: number): Promise<{ attempt: number } | null>
  /** Bump `updatedAt` on still-pending rows to renew their sweeper lease. */
  touchPending(ids: number[]): Promise<void>
  /** Put a row back in the generation queue's reach with a fresh budget. */
  requeueForRetry(id: number): Promise<{ id: number } | null>
  markImageGenerated(id: number): Promise<void>
  markError(id: number, errorText: string): Promise<void>
}

/**
 * Loud-alert port for the catastrophic `failed-write-also-failed` branch:
 * the row cannot be marked Error because the secondary write also threw,
 * so a human needs to be paged. Two adapters justify the port:
 * `telegramEscalator` (prod) fans out via the bot; `noopEscalator` (tests)
 * is silent.
 */
export interface EscalatorPort {
  alert(failure: { logId: number; message: string; writeError: string }): Promise<void>
}

export interface PipelineDeps {
  aiText: AiTextPort
  aiImage: AiImagePort
  store: ImageStorePort
  repo: LogRepositoryPort
  queue: QueuePort
  escalator: EscalatorPort
  /** Optional — defaults to the global `logger`. Tests can inject a spy. */
  logger?: Logger
}

export interface ImagePipeline {
  /** Insert + link categories + enqueue. Never generates inline. */
  submit(input: SubmitInput): Promise<SubmitResult>
  /** Fire-and-forget enqueue. Never throws; returns `false` and logs instead. */
  enqueue(logId: number, source: EnqueueSource): Promise<boolean>
  /** Reset a row to `Created` with a fresh budget, then enqueue it. */
  retry(logId: number): Promise<{ requeued: boolean; enqueued: boolean }>
  /** The work itself. Called by the queue consumer. Never throws. */
  generateImageFor(logId: number, ctx?: AttemptContext): Promise<PipelineReport>
  /** Bounded batch enqueue of pending rows. Replaces the old `drain()`. */
  enqueuePending(limit?: number): Promise<{ processed: number }>
  /** Cron reconciliation: re-enqueue stale rows, abandon exhausted ones. */
  sweep(options?: { now?: number; limit?: number }): Promise<SweepSummary>
  /** Force a pending row terminal (`Error`). Used by the dead-letter branch. */
  abandon(logId: number, reason: string): Promise<PipelineReport>
}
