import type { LogWithCategories } from '@/db/schema'
import { getLogs } from '@/services/log'
import { SortBy, TimeRange } from '@/types/search'
import { ok } from '@/utils/http'
import { z } from 'zod'

export const runtime = 'edge'

const querySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  search: z.string().optional().default(''),
  categories: z.string().optional().default('').transform(v => v.split(',').map(Number).filter(Boolean)),
  sortBy: z.nativeEnum(SortBy).optional().default(SortBy.Recent),
  timeRange: z.nativeEnum(TimeRange).optional().default(TimeRange.All),
})

export type Query = z.infer<typeof querySchema>
interface SuccessResponse {
  success: true
  data: LogWithCategories[]
  hasMore: boolean
  nextPage: number | null
}

interface ErrorResponse {
  success: false
  error: string
}

export type Response = SuccessResponse | ErrorResponse

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const result = await querySchema.safeParseAsync(Object.fromEntries(searchParams))
  if (!result.success) {
    return ok<Response>({
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

    return ok<Response>({
      success: true,
      data,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    })
  }
  catch (error) {
    return ok<Response>({
      success: false,
      error: `Failed to fetch logs: ${error}`,
    })
  }
}
