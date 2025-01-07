import type { Log } from '@/db/schema'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { desc } from 'drizzle-orm'

export const runtime = 'edge'

const ITEMS_PER_PAGE = 6

export type Response = {
  success: true
  data: Log[]
  hasMore: boolean
  nextPage: number | null
} | {
  success: false
  error: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page')) || 1
  const skip = (page - 1) * ITEMS_PER_PAGE

  try {
    const logs = await db
      .select()
      .from(log)
      .orderBy(desc(log.id))
      .limit(ITEMS_PER_PAGE)
      .offset(skip)

    const hasMore = logs.length === ITEMS_PER_PAGE

    return ok<Response>({
      success: true,
      data: logs,
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
