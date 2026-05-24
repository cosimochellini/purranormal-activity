import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getLogs } from '@/services/log'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import type { LogAllResponse } from '@/types/api/log-all'
import { SortBy, TimeRange } from '@/types/search'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from '../log/_friendly'

const querySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  search: z.string().optional().default(''),
  categories: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.split(',').map(Number).filter(Boolean)),
  sortBy: z.nativeEnum(SortBy).optional().default(SortBy.Recent),
  timeRange: z.nativeEnum(TimeRange).optional().default(TimeRange.All),
})

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to fetch logs',
  DB_UNAVAILABLE: 'Failed to fetch logs',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok<LogAllResponse>({ success: false, error: text }),
  onError: (error) => logger.error('Failed to fetch logs:', error),
})

export const Route = createFileRoute('/api/log/all')({
  server: {
    handlers: defineHandlers(
      {
        // Query parsing is done inside the handler so the failure shape
        // matches pre-refactor: `{ success: false, error: <zod message> }`
        // rather than the envelope's `errors: { <field>: [...] }`.
        GET: method<undefined, undefined, undefined, LogAllResponse>({
          reporter,
          handler: async (_input, { request }) => {
            const { searchParams } = new URL(request.url)
            const result = await querySchema.safeParseAsync(Object.fromEntries(searchParams))

            if (!result.success) {
              const data: LogAllResponse = { success: false, error: result.error.message }
              return { data }
            }

            const { page, limit, search, categories, sortBy, timeRange } = result.data
            const skip = (page - 1) * limit

            const rows = await getLogs({
              skip,
              limit,
              search,
              categories,
              sortBy,
              timeRange,
            })

            const hasMore = rows.length === limit

            const data: LogAllResponse = {
              success: true,
              data: rows,
              hasMore,
              nextPage: hasMore ? page + 1 : null,
            }
            return { data }
          },
        }),
      },
      { route: '/api/log/all' },
    ),
  },
})
