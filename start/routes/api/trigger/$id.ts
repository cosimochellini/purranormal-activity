import { createFileRoute } from '@tanstack/react-router'
import { imagePipeline } from '@/services/imagePipeline'
import { defineHandlers } from '@/services/route/defineHandlers'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'
import { createFriendly, type FriendlyMessages } from '../log/_friendly'

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

            const report = await imagePipeline.generateImageFor(logId)

            switch (report.status) {
              case 'success':
                return {
                  data: { success: true as const },
                  invalidate: [`log:${logId}`] as const,
                }
              case 'skipped':
                // skipped:not-found means the row never existed, so no
                // loader needs invalidating. Every other skip reason still
                // touched a real row whose loader should re-fetch.
                return report.reason === 'not-found'
                  ? { data: { success: false as const, error: report.reason } }
                  : {
                      data: { success: false as const, error: report.reason },
                      invalidate: [`log:${logId}`] as const,
                    }
              case 'failed':
                return {
                  data: { success: false as const, error: report.message ?? 'Unknown error' },
                  invalidate: [`log:${logId}`] as const,
                }
              default:
                return assertNever(report.status)
            }
          },
        },
      },
      { route: '/api/trigger/$id' },
    ),
  },
})
