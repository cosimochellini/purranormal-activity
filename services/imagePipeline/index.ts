import { defaultAiImage } from './adapters/aiImage'
import { defaultAiText } from './adapters/aiText'
import { defaultImageStore } from './adapters/imageStore'
import { defaultLogRepository } from './adapters/logRepository'
import { imageQueue } from './adapters/queue.server'
import { telegramEscalator } from './adapters/telegramEscalator'
import { createImagePipeline } from './core'
import type { ImagePipeline, PipelineDeps } from './ports'

export { createQueueConsumer, parseImageJob } from './consumer'
export { createImagePipeline } from './core'
export type {
  AiImagePort,
  AiTextPort,
  AttemptContext,
  DraftLog,
  EnqueueSource,
  EscalatorPort,
  ImageJob,
  ImagePipeline,
  ImageStorePort,
  LogRepositoryPort,
  LogRow,
  PendingRow,
  PipelineDeps,
  PipelineReport,
  QueuePort,
  SubmitInput,
  SubmitResult,
  SweepSummary,
} from './ports'
export { createQueueProducer } from './queue'

export const createDefaultImagePipeline = (overrides: Partial<PipelineDeps> = {}): ImagePipeline =>
  createImagePipeline({
    aiText: overrides.aiText ?? defaultAiText,
    aiImage: overrides.aiImage ?? defaultAiImage,
    store: overrides.store ?? defaultImageStore,
    repo: overrides.repo ?? defaultLogRepository,
    queue: overrides.queue ?? imageQueue,
    escalator: overrides.escalator ?? telegramEscalator,
    logger: overrides.logger,
  })

// Lazy singleton: defers `createDefaultImagePipeline()` (which transitively
// reaches the R2 and queue bindings and the Turso env vars) from import time to
// the first method call. Module-load remains side-effect-free so tests / route
// handlers that only need types from this module do not pay for
// production-adapter initialisation.
let _impl: ImagePipeline | undefined
const lazy = (): ImagePipeline => (_impl ??= createDefaultImagePipeline())

export const imagePipeline: ImagePipeline = {
  submit: (input) => lazy().submit(input),
  enqueue: (logId, source) => lazy().enqueue(logId, source),
  retry: (logId) => lazy().retry(logId),
  generateImageFor: (logId, ctx) => lazy().generateImageFor(logId, ctx),
  enqueuePending: (limit) => lazy().enqueuePending(limit),
  sweep: (options) => lazy().sweep(options),
  abandon: (logId, reason) => lazy().abandon(logId, reason),
}
