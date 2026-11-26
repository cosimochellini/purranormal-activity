import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VALIDATION_MESSAGES } from '@/constants'
import { serverEnv } from '@/env/server'
import { purgePages } from '@/services/edgeCache.server'
import { createFriendly, type FriendlyMessages } from '@/services/friendly'
import { imagePipeline } from '@/services/imagePipeline'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

// Operator endpoint: "regenerate this one's image, now". It resets the row to
// `Created` with a fresh attempt budget and enqueues it — a plain enqueue would
// be a silent no-op for `Error` rows, which are the only rows anyone ever asks
// to retry.
//
// Gated on the secret: before the queue, an abusive caller paid for their own
// abuse by holding a ~40s connection per request. An enqueue returns in
// milliseconds, so the same endpoint would become an amplifier for our OpenAI
// bill.
const triggerSchema = z.object({
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
  GENERIC_FALLBACK: 'Image pipeline failed',
  DB_UNAVAILABLE: 'Image pipeline failed',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok({ success: false, error: text }),
  onError: (error) => logger.error('trigger enqueue threw:', error),
})

interface TriggerResponse {
  success: boolean
  error?: string
}

export const Route = createFileRoute('/api/trigger/$id')({
  server: {
    handlers: defineHandlers(
      {
        POST: method<{ secret: string }, undefined, undefined, TriggerResponse>({
          body: triggerSchema,
          reporter,
          handler: async (_input, { params, request }) => {
            const logId = Number(params.id)

            if (Number.isNaN(logId)) {
              return { data: { success: false as const, error: 'Invalid log id' } }
            }

            const { requeued, enqueued } = await imagePipeline.retry(logId)

            if (!requeued) {
              return { data: { success: false as const, error: 'not-found' } }
            }

            // The row is `Created` again either way (the sweeper recovers it
            // if the enqueue itself failed), so a cached detail page is stale.
            await purgePages(new URL(request.url).origin, ['/', `/${logId}`])

            return {
              data: enqueued
                ? { success: true as const }
                : { success: false as const, error: 'Failed to enqueue image generation' },
            }
          },
        }),
      },
      { route: '/api/trigger/$id' },
    ),
  },
})
