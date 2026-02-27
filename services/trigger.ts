import { desc, eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateImageBase64, generateImagePrompt } from '@/services/ai'
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
}

export async function triggerLogImageIfPending(logId: number) {
  const [logEntry] = await db
    .select({
      id: log.id,
      status: log.status,
    })
    .from(log)
    .where(eq(log.id, logId))

  if (!logEntry || logEntry.status !== LogStatus.Created) {
    return false
  }

  await generateLogImage(logId)
  return true
}

export async function triggerFirstPendingImage() {
  const [logEntry] = await db
    .select({
      id: log.id,
    })
    .from(log)
    .where(eq(log.status, LogStatus.Created))
    .orderBy(desc(log.updatedAt))
    .limit(1)

  if (!logEntry) {
    return false
  }

  await generateLogImage(logEntry.id)
  return true
}
