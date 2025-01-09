import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'

import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { z } from 'zod'

const logFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  categories: z.array(z.number()).min(1, 'Categories are required'),
})

export type Response = {
  success: true
} | {
  success: false
  errors: Partial<Record<keyof typeof logFormSchema.shape, string[]>>
}
export const runtime = 'edge'
export async function POST(request: Request) {
  const data = await request.json()

  const result = await logFormSchema.safeParseAsync(data)

  if (!result.success) {
    return ok<Response>({
      success: false,
      errors: result.error.flatten().fieldErrors,
    })
  }

  try {
    const [created] = await db.insert(log).values({
      ...result.data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: LogStatus.Created,
    }).returning()

    await db.insert(logCategory).values(result.data.categories.map(category => ({ logId: created.id, categoryId: category })))

    return ok<Response>({ success: true })
  }
  catch (error) {
    logger.error('Failed to create log:', error)

    return ok<Response>({ success: false, errors: {} })
  }
}

export type Body = z.infer<typeof logFormSchema>
