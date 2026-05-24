import { imageStore } from '@/services/imageStore'
import type { ImageStorePort } from '../ports'

// Three-line delegate: the pipeline keeps the `ImageStorePort` seam (the
// orchestrator/tests still wire a fake adapter), and the single production
// adapter forwards to the consolidated `services/imageStore` module which
// owns the S3 client, key scheme, buffer conversion, and error wrapping.
export const defaultImageStore: ImageStorePort = {
  put: (logId, bytes) => imageStore.put(logId, bytes),
  delete: (logId) => imageStore.delete(logId),
}
