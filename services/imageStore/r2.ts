import { logger } from '@/utils/logger'
import { objectKey } from './index'

/**
 * R2 write surface, as a factory over a bucket accessor.
 *
 * The accessor indirection is what keeps this module free of
 * `cloudflare:workers`: the runtime binding is wired up once in
 * `./r2.server.ts`, and tests pass a plain fake. `R2Bucket` is a global
 * ambient type from `worker-configuration.d.ts`, so no import is needed for it
 * either.
 */
export interface ImageStore {
  put(id: number, bytes: Uint8Array): Promise<void>
  delete(id: number): Promise<void>
}

export const createR2ImageStore = (getBucket: () => R2Bucket): ImageStore => ({
  async put(id, bytes) {
    try {
      // `R2Bucket.put` takes an `ArrayBufferView`, so the caller's plain
      // `Uint8Array` goes straight through — no Buffer conversion needed.
      await getBucket().put(objectKey(id), bytes, {
        httpMetadata: { contentType: 'image/webp' },
      })
    } catch (error) {
      logger.error('Error uploading to R2:', error)
      // Message shape is a contract: `imagePipeline`'s `causeToErrorString`
      // persists it verbatim into `log.error`. Deliberately no `{ cause }` —
      // that helper prefers `cause.cause.message` and would change the text.
      throw new Error(
        `R2 upload failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      )
    }
  },

  async delete(id) {
    try {
      await getBucket().delete(objectKey(id))
    } catch (error) {
      logger.error('Error deleting object from R2:', error)
      throw new Error('Failed to delete object from R2')
    }
  },
})
