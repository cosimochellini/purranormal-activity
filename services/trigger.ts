import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateImageBase64, generateImagePrompt } from '@/services/ai'
import { invalidatePublicContent } from '@/services/content'
import { uploadToR2 } from '@/utils/cloudflare'

export async function generateLogImage(logId: number) {
  const [logEntry] = await db.select().from(log).where(eq(log.id, logId))

  if (!logEntry) {
    throw new Error('Log not found')
  }

  const imagePrompt = logEntry.imageDescription ?? (await generateImagePrompt(logEntry.description))
  const imageData = await generateImageBase64(imagePrompt)
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  await uploadToR2(buffer, logId)

  await db
    .update(log)
    .set({
      status: LogStatus.ImageGenerated,
    })
    .where(eq(log.id, logId))

  await invalidatePublicContent()
}
