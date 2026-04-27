import { logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'

export type PipelineOutcome =
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
export const NO_FAILURE: unique symbol = Symbol('NO_FAILURE')

/**
 * Resolve the human-readable error string we persist to `log.error`.
 * When the caller wraps an inner Error (the pattern used by
 * `services/imageGen.ts` and the storyForge.imagePrompt unwrap path),
 * prefer the inner cause message so the DB shows the real reason
 * (`"rate limit"`, `"content policy"`, ...) rather than the outer
 * wrapper (`"Image generation failed"`). FR-017.
 */
export const causeToErrorString = (cause: unknown): string => {
  if (cause instanceof Error) {
    if (cause.cause instanceof Error && cause.cause.message) return cause.cause.message
    return cause.message
  }
  return JSON.stringify(cause)
}

/**
 * Fire-and-forget observability helper for entry points that don't
 * surface the outcome in their HTTP response (submit, edit-PUT). Keeps
 * the spec's promise that every entry point exhaustively switches on
 * outcome.kind, even when the response shape is unchanged.
 */
export const logPipelineOutcome = (outcome: PipelineOutcome, contextLabel: string): void => {
  switch (outcome.kind) {
    case 'success':
      return
    case 'skipped':
      logger.info(`${contextLabel}: pipeline skipped log ${outcome.logId} (${outcome.reason})`)
      return
    case 'failed-recorded':
      logger.error(`${contextLabel}: pipeline recorded an error for log ${outcome.logId}`, {
        cause: outcome.cause,
      })
      return
    case 'failed-write-also-failed':
      logger.error(
        `${contextLabel}: pipeline failed to write the error column for log ${outcome.logId}`,
        {
          cause: outcome.cause,
          writeError: outcome.writeError,
        },
      )
      return
    default:
      assertNever(outcome)
  }
}
