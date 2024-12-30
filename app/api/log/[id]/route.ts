import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'edge'

const querySchema = z.object({
  id: z.number().int().positive('ID must be a positive integer'),
})

export type Response = {
  success: true
  data: typeof log['$inferSelect']
} | {
  success: false
  errors: Partial<Record<keyof typeof querySchema.shape, string[]>>
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = Object.fromEntries(url.searchParams.entries())

  const result = querySchema.safeParse(query)

  if (!result.success) {
    return ok<Response>({
      success: false,
      errors: result.error.flatten().fieldErrors,
    })
  }

  try {
    const rows = await db.select().from(log).where(eq(log.id, result.data.id))

    if (!rows.length) {
      return ok<Response>({
        success: false,
        errors: { id: ['Log entry not found'] },
      })
    }

    const [data] = rows

    return ok<Response>({ success: true, data })
  }
  catch (error) {
    logger.error('Failed to fetch log entry:', error)

    return ok<Response>({
      success: false,
      errors: { id: ['Failed to fetch log entry', JSON.stringify(error)] },
    })
  }
}
