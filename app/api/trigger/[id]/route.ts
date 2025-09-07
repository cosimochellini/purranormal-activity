import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateImageBase64, generateImagePrompt } from '@/services/ai'
import { setLogError } from '@/services/log'
import { uploadToR2 } from '@/utils/cloudflare'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export const runtime = 'edge'

export async function POST(request: Request) {
  let logId: number | undefined
  try {
    const url = new URL(request.url)
    logId = Number(url.searchParams.get('id'))

    // Get log details
    const [logEntry] = await db.select().from(log).where(eq(log.id, logId))

    if (!logEntry) return ok({ success: false, error: 'Log not found' })

    const imagePrompt =
      logEntry.imageDescription ?? (await generateImagePrompt(logEntry.description))

    const imageData = await generateImageBase64(imagePrompt)

    // Convert base64 to buffer directly
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    await uploadToR2(buffer, logId)

    // Update log status and blurDataURL
    await db
      .update(log)
      .set({
        status: LogStatus.ImageGenerated,
      })
      .where(eq(log.id, logId))

    revalidatePath('/', 'layout')

    return ok({ success: true })
  } catch (error) {
    logger.error('Failed to generate image:', error)
    await setLogError(logId, error)

    return ok({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
