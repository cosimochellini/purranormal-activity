import { defaultAiImage } from './adapters/aiImage'
import { defaultAiText } from './adapters/aiText'
import { defaultImageStore } from './adapters/imageStore'
import { defaultLogRepository } from './adapters/logRepository'
import { createImagePipeline } from './core'
import type { ImagePipeline, PipelineDeps } from './ports'

export { createImagePipeline } from './core'
export {
  causeToErrorString,
  logPipelineOutcome,
  NO_FAILURE,
  type PipelineOutcome,
} from './outcome'
export type {
  AiImagePort,
  AiTextPort,
  DraftLog,
  ImagePipeline,
  ImageStorePort,
  LogRepositoryPort,
  LogRow,
  PipelineDeps,
  SubmitInput,
  SubmitResult,
} from './ports'

export const createDefaultImagePipeline = (overrides: Partial<PipelineDeps> = {}): ImagePipeline =>
  createImagePipeline({
    aiText: overrides.aiText ?? defaultAiText,
    aiImage: overrides.aiImage ?? defaultAiImage,
    store: overrides.store ?? defaultImageStore,
    repo: overrides.repo ?? defaultLogRepository,
  })

export const imagePipeline: ImagePipeline = createDefaultImagePipeline()
