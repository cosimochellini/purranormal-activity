import { createFileRoute } from '@tanstack/react-router'
import { imagePipeline } from '@/services/imagePipeline'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : 'Unknown error')

export const Route = createFileRoute('/api/trigger/$id')({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const logId = Number(params.id)

        if (Number.isNaN(logId)) {
          return ok({ success: false, error: 'Invalid log id' })
        }

        const outcome = await imagePipeline.run(logId)

        switch (outcome.kind) {
          case 'success':
            return ok({ success: true }, { invalidate: [`log:${logId}`] })

          case 'skipped':
            return outcome.reason === 'not-found'
              ? ok({ success: false, error: outcome.reason })
              : ok({ success: false, error: outcome.reason }, { invalidate: [`log:${logId}`] })

          case 'failed-recorded':
            logger.error('image pipeline recorded an error', {
              logId,
              cause: outcome.cause,
            })
            return ok(
              { success: false, error: errorMessage(outcome.cause) },
              { invalidate: [`log:${logId}`] },
            )

          case 'failed-write-also-failed':
            logger.error('image pipeline failed to write the error column', {
              logId,
              cause: outcome.cause,
              writeError: outcome.writeError,
            })
            return ok(
              { success: false, error: errorMessage(outcome.cause) },
              { invalidate: [`log:${logId}`] },
            )
          default:
            return assertNever(outcome)
        }
      },
    },
  },
})
