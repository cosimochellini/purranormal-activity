import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getLogs } from '@/services/log'
import type { LogAllResponse } from '@/types/api/log-all'
import { SortBy, TimeRange } from '@/types/search'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

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

export const Route = createFileRoute('/api/log/all')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams } = new URL(request.url)
        const result = await querySchema.safeParseAsync(Object.fromEntries(searchParams))

        if (!result.success) {
          return ok<LogAllResponse>({
            success: false,
            error: result.error.message,
          })
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
          return ok<LogAllResponse>({
            success: false,
            error: 'Failed to fetch logs',
          })
        }
      },
    },
  },
})
