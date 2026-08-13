import { imageStore } from '@/services/imageStore/r2.server'
import type { ImageStorePort } from '../ports'

// Three-line delegate: the pipeline keeps the `ImageStorePort` seam (the
// orchestrator/tests still wire a fake adapter), and the single production
// adapter forwards to `services/imageStore/r2.server`, which owns the R2
// binding, the key scheme, and the error wrapping.
export const defaultImageStore: ImageStorePort = {
  put: (logId, bytes) => imageStore.put(logId, bytes),
  delete: (logId) => imageStore.delete(logId),
}
