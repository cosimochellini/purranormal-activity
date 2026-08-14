import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { serverEnv } from '@/env/server'
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
  // Gated for the same reason as `/api/script` and `/api/trigger/[id]`: this
  // endpoint inserts rows with status `Created`, and the cron sweeper now picks
  // those up and pays for an image. Without a gate it is a free, recurring
  // amplifier for the OpenAI bill — the one open door that would defeat the
  // gates on every other entry point. Every other write endpoint (submit, PUT,
  // DELETE) already required this.
  secret: z
    .string()
    .min(1, VALIDATION_MESSAGES.SECRET_REQUIRED)
    .refine((val) => val.toLowerCase() === serverEnv.secret, {
      message: VALIDATION_MESSAGES.SECRET_INVALID,
    }),
})

const FALLBACK_COPY = 'Failed to create log. Please try again.'

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: FALLBACK_COPY,
  DB_UNAVAILABLE: FALLBACK_COPY,
}

// The catch path is handled INSIDE the handler so every throw maps to the
// unconditional fallback copy — pre-refactor behaviour. The reporter still
// guards against unexpected throws (e.g. validation infra), but the
// in-handler catch wins for db-write failures.
const reporter = createFriendly<Response>({
  messages,
  build: () => ok<LogPostResponse>({ success: false, errors: { general: [FALLBACK_COPY] } }),
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
            // `secret` is destructured OUT rather than spread through: it is a
            // credential, not a column, and `...body` would carry it into the
            // insert.
            const { secret: _secret, ...draft } = body
            try {
              const [created] = await db
                .insert(log)
                .values({
                  ...draft,
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
            } catch (error) {
              logger.error('Failed to create log:', error)
              const data: LogPostResponse = {
                success: false,
                errors: { general: [FALLBACK_COPY] },
              }
              return { data }
            }
          },
        }),
      },
      { route: '/api/log' },
    ),
  },
})
