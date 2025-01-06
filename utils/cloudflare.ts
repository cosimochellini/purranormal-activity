/* eslint-disable node/prefer-global/buffer */
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { BUCKET_NAME, CLOUDFLARE_DEPLOY_URL, CLOUDFLARE_PUBLIC_URL } from '../env/cloudflare'
import { S3 } from '../instances/s3'
import { logger } from './logger'

export const publicImage = (id: number) => `https://${CLOUDFLARE_PUBLIC_URL}/${id}/cover.webp` as const

export const redeploy = () => fetch(CLOUDFLARE_DEPLOY_URL, { method: 'POST' })
export async function uploadToR2(buffer: Buffer, logId: number) {
  try {
    await S3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${logId}/cover.webp`,
      Body: buffer,
      ContentType: 'image/webp',
    }))
  }
  catch (error) {
    logger.error('Error uploading to R2:', error)
    throw new Error('R2 upload failed')
  }
}

export async function deleteFromR2(logId: number) {
  try {
    await S3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${logId}/cover.webp`,
      }),
    )
  }
  catch (error) {
    logger.error('Error deleting object from R2:', error)
    throw new Error('Failed to delete object from R2')
  }
}
