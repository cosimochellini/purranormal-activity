import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { regenerateContents } from '@/utils/next'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'edge'

export type GetResponse = {
  success: true
  data: typeof log['$inferSelect']
} | {
  success: false

}
const getLog = async (id: number) => (await db.select().from(log).where(eq(log.id, id)))[0]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))

  try {
    const log = await getLog(id)

    if (!log) {
      return ok<GetResponse>({
        success: false,
      })
    }

    return ok<GetResponse>({ success: true, data: log })
  }
  catch (error) {
    logger.error('Failed to fetch log entry:', error)

    return ok<GetResponse>({
      success: false,
    })
  }
}
const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  categories: z.string().min(1),
  imageDescription: z.string().optional(),
})

export type PutResponse = {
  success: true
  data: typeof log.$inferSelect
} | {
  success: false
  errors: Partial<Record<keyof typeof schema.shape, string[]>>
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const data = await request.json()

    const result = await schema.safeParseAsync(data)

    if (!result.success) {
      return ok<PutResponse>({
        success: false,
        errors: result.error.flatten().fieldErrors,
      })
    }
    const currentLog = await getLog(id)

    const { title, description, categories, imageDescription } = result.data

    const [updated] = await db
      .update(log)
      .set({
        ...currentLog,
        title,
        description,
        categories,
        imageDescription,
        updatedAt: Date.now(),
        status: imageDescription !== currentLog.imageDescription ? LogStatus.Created : LogStatus.ImageGenerated,
      })
      .where(eq(log.id, id))
      .returning()

    regenerateContents()

    return ok<PutResponse>({ success: true, data: updated })
  }
  catch (error) {
    logger.error('Failed to update log:', error)

    return ok<PutResponse>({
      success: false,
      errors: {
        title: ['Failed to update log'],
      },
    })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))

    await db
      .delete(log)
      .where(eq(log.id, id))

    regenerateContents()

    return ok({ success: true })
  }
  catch (error) {
    logger.error('Failed to delete log:', error)

    return ok({
      success: false,
      error: 'Failed to delete log',
    })
  }
}
