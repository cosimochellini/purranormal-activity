import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getLogs } from '@/services/log'
import type { LogAllResponse } from '@/types/api/log-all'
import { SortBy, TimeRange } from '@/types/search'
import { ok, StatusCode } from '@/utils/http'
import { logger } from '@/utils/logger'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

const parseCategories = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => Number.parseInt(item, 10))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  )

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  search: z
    .string()
    .optional()
    .default('')
    .transform((value) => value.trim().slice(0, 200)),
  categories: z.string().optional().default('').transform(parseCategories),
  sortBy: z.nativeEnum(SortBy).optional().default(SortBy.Recent),
  timeRange: z.nativeEnum(TimeRange).optional().default(TimeRange.All),
})

export const Route = createFileRoute('/api/log/all')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url)
        const result = await querySchema.safeParseAsync(Object.fromEntries(searchParams))

        if (!result.success) {
          return ok<LogAllResponse>(
            {
              success: false,
              error: result.error.message,
            },
            { status: StatusCode.BadRequest },
          )
        }

        const { page, limit, search, categories, sortBy, timeRange } = result.data
        const skip = (page - 1) * limit

        try {
          const data = await getLogs({
            skip,
            limit,
            search,
            categories,
            sortBy,
            timeRange,
          })

          const hasMore = data.length === limit

          return ok<LogAllResponse>({
            success: true,
            data,
            hasMore,
            nextPage: hasMore ? page + 1 : null,
          })
        } catch (error) {
          logger.error('Failed to fetch logs:', error)
          return ok<LogAllResponse>(
            {
              success: false,
              error: 'Failed to fetch logs',
            },
            { status: StatusCode.InternalServerError },
          )
        }
      },
    },
  },
})
