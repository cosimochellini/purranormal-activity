import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

export type Response = {
  success: true
  data: typeof log['$inferSelect']
} | {
  success: false

}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))

  try {
    const rows = await db.select().from(log).where(eq(log.id, id))

    if (!rows.length) {
      return ok<Response>({
        success: false,

      })
    }

    const [data] = rows

    return ok<Response>({ success: true, data })
  }
  catch (error) {
    logger.error('Failed to fetch log entry:', error)

    return ok<Response>({
      success: false,
    })
  }
}
