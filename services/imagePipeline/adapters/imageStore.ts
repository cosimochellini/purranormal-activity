/* eslint-disable node/prefer-global/buffer */

import { deleteFromR2, uploadToR2 } from '@/utils/cloudflare'
import type { ImageStorePort } from '../ports'

// `Buffer` is polyfilled by `@cloudflare/workers-types` and is required
// by the AWS SDK's `PutObjectCommand` body. The conversion lives here
// (not in the pipeline core) so the orchestrator stays Buffer-free.
export const defaultImageStore: ImageStorePort = {
  put: async (logId, bytes) => {
    await uploadToR2(Buffer.from(bytes), logId)
  },
  delete: (logId) => deleteFromR2(logId),
}
