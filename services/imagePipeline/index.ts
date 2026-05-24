import { defaultAiImage } from './adapters/aiImage'
import { defaultAiText } from './adapters/aiText'
import { defaultImageStore } from './adapters/imageStore'
import { defaultLogRepository } from './adapters/logRepository'
import { telegramEscalator } from './adapters/telegramEscalator'
import { createImagePipeline } from './core'
import type { ImagePipeline, PipelineDeps } from './ports'

export { createImagePipeline } from './core'
export type {
  AiImagePort,
  AiTextPort,
  DraftLog,
  EscalatorPort,
  ImagePipeline,
  ImageStorePort,
  LogRepositoryPort,
  LogRow,
  PipelineDeps,
  PipelineReport,
  SubmitInput,
  SubmitResult,
} from './ports'

export const createDefaultImagePipeline = (overrides: Partial<PipelineDeps> = {}): ImagePipeline =>
  createImagePipeline({
    aiText: overrides.aiText ?? defaultAiText,
    aiImage: overrides.aiImage ?? defaultAiImage,
    store: overrides.store ?? defaultImageStore,
    repo: overrides.repo ?? defaultLogRepository,
    escalator: overrides.escalator ?? telegramEscalator,
    logger: overrides.logger,
  })

// Lazy singleton: defers `createDefaultImagePipeline()` (which transitively
// constructs the S3 client and reads cloudflare/Turso env vars) from import
// time to the first method call. Module-load remains side-effect-free so
// tests / route handlers that only need types from this module do not pay
// for production-adapter initialisation.
let _impl: ImagePipeline | undefined
const lazy = (): ImagePipeline => (_impl ??= createDefaultImagePipeline())

export const imagePipeline: ImagePipeline = {
  submit: (input) => lazy().submit(input),
  generateImageFor: (logId) => lazy().generateImageFor(logId),
  drain: () => lazy().drain(),
}
