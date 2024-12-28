import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'

import { LogStatus } from '../../../../data/enum/logStatus'
import { BUCKET_NAME } from '../../../../env/cloudflare'
import { S3 } from '../../../../instances/s3'
import { generateImage, generateImagePrompt } from '../../../../services/ai'
import { logger } from '../../../../utils/logger'

export const runtime = 'edge'

async function downloadImageAsBuffer(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  // eslint-disable-next-line node/prefer-global/buffer
  return Buffer.from(arrayBuffer)
}

// eslint-disable-next-line node/prefer-global/buffer
async function uploadToS3(buffer: Buffer, logId: number) {
  try {
    await S3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${logId}/cover.webp`,
      Body: buffer,
      ContentType: 'image/webp',
    }))
  }
  catch (error) {
    logger.error('Error uploading to S3:', error)
    throw new Error('S3 upload failed')
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const logId = Number(url.searchParams.get('id'))

    // Get log details
    const [logEntry] = await db
      .select()
      .from(log)
      .where(eq(log.id, logId))

    if (!logEntry)
      return ok({ success: false, error: 'Log not found' })

    const imagePrompt = logEntry.imageDescription ?? await generateImagePrompt(logEntry.description)

    const imageData = await generateImage(imagePrompt)

    const buffer = await downloadImageAsBuffer(imageData)

    await uploadToS3(buffer, logId)

    // Update log status
    await db
      .update(log)
      .set({ status: LogStatus.ImageGenerated })
      .where(eq(log.id, logId))

    return ok({ success: true })
  }
  catch (error) {
    logger.error('Failed to generate image:', error)

    return ok({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
