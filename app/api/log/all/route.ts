import type { LogWithCategories } from '@/db/schema'

import { getLogs } from '@/services/log'
import { ok } from '@/utils/http'

export const runtime = 'edge'

const ITEMS_PER_PAGE = 6

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
  const page = Number(searchParams.get('page')) || 1
  const skip = (page - 1) * ITEMS_PER_PAGE

  try {
    const data = await getLogs(skip, ITEMS_PER_PAGE)

    const hasMore = data.length === ITEMS_PER_PAGE

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
