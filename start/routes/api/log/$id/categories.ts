import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import type { LogIdCategoriesPostResponse } from '@/types/api/log-id-categories'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from '../_friendly'

const schema = z.object({
  categories: z
    .array(z.number())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORY_REQUIRED),
})

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to add categories to log',
  DB_UNAVAILABLE: 'Failed to add categories to log',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) =>
    ok<LogIdCategoriesPostResponse>({ success: false, errors: { categories: [text] } }),
  onError: (error) => logger.error('Failed to add categories to log:', error),
})

export const Route = createFileRoute('/api/log/$id/categories')({
  server: {
    handlers: defineHandlers(
      {
        POST: method<{ categories: number[] }, undefined, undefined, LogIdCategoriesPostResponse>({
          body: schema,
          reporter,
          handler: async ({ body }, { params }) => {
            const logId = Number(params.id)
            if (Number.isNaN(logId)) {
              const data: LogIdCategoriesPostResponse = {
                success: false,
                errors: { categories: ['Invalid log id'] },
              }
              return { data }
            }

            await db.insert(logCategory).values(
              body.categories.map((categoryId) => ({
                logId,
                categoryId,
              })),
            )

            const data: LogIdCategoriesPostResponse = { success: true }
            return { data, invalidate: ['logs', `log:${logId}`] }
          },
        }),
      },
      { route: '/api/log/$id/categories' },
    ),
  },
})
