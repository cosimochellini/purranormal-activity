import { createFileRoute } from '@tanstack/react-router'
import { imagePipeline } from '@/services/imagePipeline'
import { defineHandlers } from '@/services/route/defineHandlers'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'
import { createFriendly, type FriendlyMessages } from '../log/_friendly'

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : 'Unknown error')

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Image pipeline failed',
  DB_UNAVAILABLE: 'Image pipeline failed',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok({ success: false, error: text }),
  onError: (error) => logger.error('trigger pipeline threw:', error),
})

export const Route = createFileRoute('/api/trigger/$id')({
  server: {
    handlers: defineHandlers(
      {
        POST: {
          reporter,
          handler: async (_input, { params }) => {
            const logId = Number(params.id)

            if (Number.isNaN(logId)) {
              return { data: { success: false as const, error: 'Invalid log id' } }
            }

            const outcome = await imagePipeline.generateImageFor(logId)

            switch (outcome.kind) {
              case 'success':
                return {
                  data: { success: true as const },
                  invalidate: [`log:${logId}`] as const,
                }

              case 'skipped':
                return outcome.reason === 'not-found'
                  ? { data: { success: false as const, error: outcome.reason } }
                  : {
                      data: { success: false as const, error: outcome.reason },
                      invalidate: [`log:${logId}`] as const,
                    }

              case 'failed-recorded':
                logger.error('image pipeline recorded an error', {
                  logId,
                  cause: outcome.cause,
                })
                return {
                  data: { success: false as const, error: errorMessage(outcome.cause) },
                  invalidate: [`log:${logId}`] as const,
                }

              case 'failed-write-also-failed':
                logger.error('image pipeline failed to write the error column', {
                  logId,
                  cause: outcome.cause,
                  writeError: outcome.writeError,
                })
                return {
                  data: { success: false as const, error: errorMessage(outcome.cause) },
                  invalidate: [`log:${logId}`] as const,
                }
              default:
                return assertNever(outcome)
            }
          },
        },
      },
      { route: '/api/trigger/$id' },
    ),
  },
})
