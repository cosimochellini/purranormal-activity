import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import type { LogPostBody, LogPostResponse } from '@/types/api/log'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from './log/_friendly'

const logFormSchema = z.object({
  title: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.TITLE_REQUIRED)
    .max(CHARACTER_LIMITS.TITLE, VALIDATION_MESSAGES.TITLE_TOO_LONG),
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  categories: z
    .array(z.number())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORIES_REQUIRED),
})

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to create log. Please try again.',
  DB_UNAVAILABLE: 'Failed to create log. Please try again.',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok<LogPostResponse>({ success: false, errors: { general: [text] } }),
  onError: (error) => logger.error('Failed to create log:', error),
})

export const Route = createFileRoute('/api/log')({
  server: {
    handlers: defineHandlers(
      {
        POST: method<LogPostBody, undefined, undefined, LogPostResponse>({
          body: logFormSchema,
          reporter,
          handler: async ({ body }) => {
            const [created] = await db
              .insert(log)
              .values({
                ...body,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: LogStatus.Created,
              })
              .returning()

            if (body.categories.length > 0) {
              await db.insert(logCategory).values(
                body.categories.map((category) => ({
                  logId: created.id,
                  categoryId: category,
                })),
              )
            }

            const data: LogPostResponse = { success: true }
            return { data, invalidate: ['logs'] }
          },
        }),
      },
      { route: '/api/log' },
    ),
  },
})
