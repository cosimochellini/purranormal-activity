/* eslint-disable node/prefer-global/buffer */

import { Buffer } from 'node:buffer'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ACCESS_KEY_ID, ACCOUNT_ID, BUCKET_NAME, SECRET_ACCESS_KEY } from '@/env/cloudflare'
import { VITE_CLOUDFLARE_PUBLIC_URL } from '@/env/public'
import { logger } from '@/utils/logger'

// Single key-scheme constant: rename = one edit.
const objectKey = (id: number) => `${id}/cover.webp` as const

// Lazy S3 client: production cold start on Workers must not pay for an
// `S3Client` constructor (which reads region/credentials/endpoint) before
// the first R2 call. Preserves the pattern from the deleted `instances/s3.ts`.
let _client: S3Client | undefined
const getClient = (): S3Client => {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    })
  }
  return _client
}

export interface ImageStore {
  put(id: number, bytes: Uint8Array): Promise<void>
  delete(id: number): Promise<void>
  publicUrl(id: number): string
}

export const imageStore: ImageStore = {
  async put(id, bytes) {
    try {
      await getClient().send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey(id),
          // `Buffer.from(bytes)` keeps the AWS SDK's `PutObjectCommand` body
          // typing happy on Workers (where `Buffer` is polyfilled by
          // `@cloudflare/workers-types`). Conversion lives here so callers
          // can pass a plain `Uint8Array`.
          Body: Buffer.from(bytes),
          ContentType: 'image/webp',
        }),
      )
    } catch (error) {
      logger.error('Error uploading to R2:', error)
      throw new Error(
        `R2 upload failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      )
    }
  },

  async delete(id) {
    try {
      await getClient().send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey(id),
        }),
      )
    } catch (error) {
      logger.error('Error deleting object from R2:', error)
      throw new Error('Failed to delete object from R2')
    }
  },

  publicUrl(id) {
    if (!VITE_CLOUDFLARE_PUBLIC_URL) return ''
    return `https://${VITE_CLOUDFLARE_PUBLIC_URL}/${objectKey(id)}`
  },
}
