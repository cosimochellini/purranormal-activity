import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { category } from '@/db/schema'
import { db } from '@/drizzle'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import { storyForge } from '@/services/storyForge'
import type { CategoriesGetResponse, CategoriesPostResponse } from '@/types/api/categories'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from './log/_friendly'

const schema = z.object({
  categories: z
    .array(z.string())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORY_REQUIRED),
})

const baseMessages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to fetch categories',
  DB_UNAVAILABLE: 'Failed to fetch categories',
}

// GET swallows the message — the public failure shape is the empty list.
const getReporter = createFriendly<Response>({
  messages: baseMessages,
  build: () => ok<CategoriesGetResponse>([]),
  onError: (error) => logger.error('Failed to fetch categories:', error),
})

const postReporter = createFriendly<Response>({
  messages: { ...baseMessages, GENERIC_FALLBACK: 'Failed to create categories' },
  build: () =>
    ok<CategoriesPostResponse>({
      success: false,
      errors: { categories: ['Failed to create categories'] },
    }),
  onError: (error) => logger.error('Failed to create categories:', error),
})

export const Route = createFileRoute('/api/categories')({
  server: {
    handlers: defineHandlers(
      {
        GET: method<undefined, undefined, undefined, CategoriesGetResponse>({
          reporter: getReporter,
          handler: async () => {
            const categories = await db.select().from(category)
            const data: CategoriesGetResponse = categories
            return { data }
          },
        }),
        POST: method<{ categories: string[] }, undefined, undefined, CategoriesPostResponse>({
          body: schema,
          reporter: postReporter,
          handler: async ({ body }) => {
            const categories = await db
              .insert(category)
              .values(
                body.categories.map((name) => ({
                  name,
                  icon: 'questionMark',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                })),
              )
              .returning({
                id: category.id,
                name: category.name,
              })

            // Drop the StoryForge category cache so a subsequent /api/log/submit
            // sees the new ids and does not silently filter them out as missing.
            storyForge.invalidateCategories()

            const data: CategoriesPostResponse = { success: true, categories }
            return { data }
          },
        }),
      },
      { route: '/api/categories' },
    ),
  },
})
