import type { LogStatus } from '@/data/enum/logStatus'
import type { AIResult } from '@/services/storyForge'
import type { PipelineOutcome } from './outcome'

export interface DraftLog {
  title: string
  description: string
  imageDescription: string | null
}

export interface LogRow {
  id: number
  description: string
  imageDescription: string | null
  status: LogStatus
}

export interface SubmitInput {
  draft: DraftLog
  categoryIds: number[]
}

export interface SubmitResult {
  id: number
  outcome: PipelineOutcome
}

export interface AiTextPort {
  imagePrompt(description: string): Promise<AIResult<string>>
}

export interface AiImagePort {
  generateBase64(prompt: string): Promise<string>
}

export interface ImageStorePort {
  put(logId: number, bytes: Uint8Array): Promise<void>
  delete(logId: number): Promise<void>
}

export interface LogRepositoryPort {
  insertDraft(draft: DraftLog): Promise<{ id: number }>
  linkCategories(logId: number, categoryIds: number[]): Promise<void>
  findById(id: number): Promise<LogRow | null>
  findFirstPending(): Promise<{ id: number } | null>
  loadStatus(id: number): Promise<{ status: LogStatus } | null>
  markImageGenerated(id: number): Promise<void>
  markError(id: number, errorText: string): Promise<void>
}

export interface PipelineDeps {
  aiText: AiTextPort
  aiImage: AiImagePort
  store: ImageStorePort
  repo: LogRepositoryPort
}

export interface ImagePipeline {
  submit(input: SubmitInput): Promise<SubmitResult>
  generateImageFor(logId: number): Promise<PipelineOutcome>
  drainOnePending(): Promise<PipelineOutcome | null>
}
