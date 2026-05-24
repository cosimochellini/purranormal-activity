import type { LogStatus } from '@/data/enum/logStatus'
import type { AIResult } from '@/services/storyForge'
import type { Logger } from '@/utils/logger'

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

/**
 * External-facing pipeline result. Collapses the internal 4-kind
 * `PipelineOutcome` discriminator (success | skipped | failed-recorded |
 * failed-write-also-failed) into a 3-kind status. The internal "secondary
 * write also failed" branch is escalated via `EscalatorPort` and surfaces
 * here as a plain `status: 'failed'`.
 */
export interface PipelineReport {
  status: 'success' | 'skipped' | 'failed'
  logId: number
  /** Present iff `status === 'skipped'`. */
  reason?: 'not-found' | 'not-pending'
  /** Present iff `status === 'failed'`. */
  message?: string
}

export interface SubmitResult {
  id: number
  report: PipelineReport
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

/**
 * Loud-alert port for the catastrophic `failed-write-also-failed` branch:
 * the row cannot be marked Error because the secondary write also threw,
 * so a human needs to be paged. Two adapters justify the port:
 * `telegramEscalator` (prod) fans out via the bot; `noopEscalator` (tests)
 * is silent.
 */
export interface EscalatorPort {
  alert(failure: { logId: number; message: string; writeError: string }): Promise<void>
}

export interface PipelineDeps {
  aiText: AiTextPort
  aiImage: AiImagePort
  store: ImageStorePort
  repo: LogRepositoryPort
  escalator: EscalatorPort
  /** Optional — defaults to the global `logger`. Tests can inject a spy. */
  logger?: Logger
}

export interface ImagePipeline {
  submit(input: SubmitInput): Promise<{ id: number; report: PipelineReport }>
  generateImageFor(logId: number): Promise<PipelineReport>
  drain(): Promise<{ processed: number; failed: number }>
}
