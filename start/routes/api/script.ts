import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VALIDATION_MESSAGES } from '@/constants'
import { serverEnv } from '@/env/server'
import { createFriendly, type FriendlyMessages } from '@/services/friendly'
import { imagePipeline } from '@/services/imagePipeline'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

// Manual kick for the queue: enqueues every pending log (capped) without
// generating anything inline. The cron sweeper covers the same ground
// automatically; this endpoint exists for local development (where the cron
// trigger is awkward to fire) and for operators who do not want to wait for
// the next tick.
const scriptSchema = z.object({
  // Gated because an enqueue is cheap for the caller and expensive for us:
  // every queued message becomes a paid image generation.
  secret: z
    .string()
    .min(1, VALIDATION_MESSAGES.SECRET_REQUIRED)
    .refine((val) => val.toLowerCase() === serverEnv.secret, {
      message: VALIDATION_MESSAGES.SECRET_INVALID,
    }),
})

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
  onError: (error) => logger.error('imagePipeline.enqueuePending failed:', error),
})

interface ScriptResponse {
  success: boolean
  processed?: number
  error?: string
}

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: defineHandlers(
      {
        POST: method<{ secret: string }, undefined, undefined, ScriptResponse>({
          body: scriptSchema,
          reporter,
          handler: async () => {
            const { processed } = await imagePipeline.enqueuePending()
            // No `invalidate`: enqueueing mutates no row that a loader reads.
            // The detail page's poller picks the change up once the consumer
            // has actually generated the image.
            return { data: { success: true as const, processed } }
          },
        }),
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
