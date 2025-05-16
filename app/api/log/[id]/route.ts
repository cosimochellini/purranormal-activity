import { LogStatus } from '@/data/enum/logStatus'
import type { Log } from '@/db/schema'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { SECRET } from '@/env/secret'
import { deleteFromR2 } from '@/utils/cloudflare'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { regenerateContents } from '@/utils/next'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const runtime = 'edge'

export type GetResponse =
  | {
      success: true
      data: Log
    }
  | {
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
  } catch (error) {
    logger.error('Failed to fetch log entry:', error)

    return ok<GetResponse>({
      success: false,
    })
  }
}
const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  categories: z.array(z.number()).min(1, 'Categories are required'),
  imageDescription: z.string().nullable(),
  secret: z.string().refine((val) => val === SECRET, { message: 'Invalid secret' }),
})

export type PutResponse =
  | {
      success: true
      data: Log
    }
  | {
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
    if (!currentLog) {
      return ok<PutResponse>({
        success: false,
        errors: { title: ['Log not found'] },
      })
    }

    const { title, description, categories, imageDescription } = result.data

    const [updated] = await db
      .update(log)
      .set({
        ...currentLog,
        title,
        description,
        imageDescription,
        updatedAt: Date.now(),
        status:
          imageDescription !== currentLog.imageDescription
            ? LogStatus.Created
            : LogStatus.ImageGenerated,
      })
      .where(eq(log.id, id))
      .returning()

    await db.delete(logCategory).where(eq(logCategory.logId, id))

    if (categories.length > 0) {
      await db
        .insert(logCategory)
        .values(categories.map((category) => ({ logId: id, categoryId: category })))
    }

    regenerateContents()

    return ok<PutResponse>({ success: true, data: updated })
  } catch (error) {
    logger.error('Failed to update log:', error)

    return ok<PutResponse>({
      success: false,
      errors: {
        title: ['Failed to update log'],
      },
    })
  }
}

export type PutBody = z.infer<typeof schema>

/**
 * For the DELETE route, we similarly need to check `secret`. We'll parse the
 * JSON body (rather than only using query params) and validate against a small schema.
 */
const deleteSchema = z.object({
  secret: z.string().refine((val) => val === SECRET, { message: 'Invalid secret' }),
})

export async function DELETE(request: Request) {
  try {
    // parse the JSON body to validate the secret
    const data = await request.json()
    const parsed = deleteSchema.safeParse(data)

    if (!parsed.success) {
      return ok({
        success: false,
        error: 'Invalid secret',
      })
    }

    // if secret is valid, continue
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))

    await db.delete(log).where(eq(log.id, id))
    await deleteFromR2(id)

    regenerateContents()

    return ok({ success: true })
  } catch (error) {
    logger.error('Failed to delete log:', error)

    return ok({
      success: false,
      error: 'Failed to delete log',
    })
  }
}
export type DeleteResponse =
  | {
      success: true
    }
  | {
      success: false
      errors: Partial<Record<keyof typeof deleteSchema.shape, string[]>>
    }
