import { createFileRoute } from '@tanstack/react-router'
import { imagePipeline } from '@/services/imagePipeline'
import { defineHandlers } from '@/services/route/defineHandlers'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from './log/_friendly'

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to process logs',
  DB_UNAVAILABLE: 'Failed to process logs',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok({ success: false, processed: 0, error: text }),
  onError: (error) => logger.error('imagePipeline.drain failed:', error),
})

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: defineHandlers(
      {
        POST: {
          reporter,
          handler: async () => {
            const { processed } = await imagePipeline.drain()
            // Tag list-affecting routes only when at least one row was mutated.
            return {
              data: { success: true as const, processed },
              invalidate: processed > 0 ? (['logs'] as const) : undefined,
            }
          },
        },
      },
      {
        route: '/api/script',
        // TanStack Start does NOT emit a default 405 when a handler is
        // missing for the requested method — control falls through to the
        // page route. The `methodNotAllowed` option lets the envelope own
        // the 405 + `Allow:` header for this route without a hand-merged
        // spread of envelope output plus extra entries.
        methodNotAllowed: ['GET'],
      },
    ),
  },
})
