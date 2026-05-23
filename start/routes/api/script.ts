import { createFileRoute } from '@tanstack/react-router'
import { defineHandlers } from '@/services/route/defineHandlers'
import { runImageGenerationScript } from '@/services/script'
import { methodNotAllowed, ok } from '@/utils/http'
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
  onError: (error) => logger.error('runImageGenerationScript failed:', error),
})

const envelope = defineHandlers(
  {
    POST: {
      reporter,
      handler: async () => {
        const response = await runImageGenerationScript()
        // Tag list-affecting routes only when at least one row was mutated.
        return {
          data: response,
          invalidate: response.processed > 0 ? (['logs'] as const) : undefined,
        }
      },
    },
  },
  { route: '/api/script' },
)

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: {
      ...envelope,
      // The envelope does not own non-200 responses; GET stays hand-rolled.
      GET: async () => methodNotAllowed('POST'),
    },
  },
})
