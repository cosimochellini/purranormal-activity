/* eslint-disable node/prefer-global/buffer */
import {
  ACCOUNT_ID,
  BUCKET_NAME,
  CLOUDFLARE_DEPLOY_URL,
  CLOUDFLARE_IMAGE_TOKEN,
  CLOUDFLARE_PUBLIC_URL,
} from '@/env/cloudflare'
import { S3 } from '@/instances/s3'
import { logger } from '@/utils/logger'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { fetcher } from './fetch'

export const publicImage = (id: number) =>
  `https://${CLOUDFLARE_PUBLIC_URL}/${id}/cover.webp` as const

export const redeploy = fetcher<never, never, never>(CLOUDFLARE_DEPLOY_URL, 'POST')

interface CloudflareImageUploadResponse {
  result: {
    id: string
    filename: string
    metadata?: Record<string, string>
    uploaded: string
    requireSignedURLs: boolean
    variants: string[]
  }
  success: boolean
  errors: string[]
  messages: string[]
}

export async function uploadToCloudflareImages(
  imageUrl: string,
  metadata?: Record<string, string>,
) {
  try {
    const formData = new FormData()
    formData.append('url', imageUrl)
    formData.append('requireSignedURLs', 'false')

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_IMAGE_TOKEN}`,
        },
        body: formData,
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to upload to Cloudflare Images: ${JSON.stringify(error)}`)
    }

    return response.json() as Promise<CloudflareImageUploadResponse>
  } catch (error) {
    logger.error('Error uploading to Cloudflare Images:', error)
    throw new Error('Cloudflare Images upload failed')
  }
}

export async function uploadToR2(buffer: Buffer, logId: number) {
  try {
    return S3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${logId}/cover.webp`,
        Body: buffer,
        ContentType: 'image/webp',
      }),
    )
  } catch (error) {
    logger.error('Error uploading to R2:', error)
    throw new Error(
      `R2 upload failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    )
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
  } catch (error) {
    logger.error('Error deleting object from R2:', error)
    throw new Error('Failed to delete object from R2')
  }
}
