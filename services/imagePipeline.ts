import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateImageBase64 } from '@/services/imageGen'
import { storyForge } from '@/services/storyForge'
import { uploadToR2 } from '@/utils/cloudflare'
import { logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'

export type PipelineOutcome =
  | { kind: 'success'; logId: number }
  | { kind: 'skipped'; logId: number; reason: 'not-found' | 'not-pending' }
  | { kind: 'failed-recorded'; logId: number; cause: unknown }
  | {
      kind: 'failed-write-also-failed'
      logId: number
      cause: unknown
      writeError: unknown
    }

export interface PipelineDeps {
  loadStatus: (id: number) => Promise<{ status: LogStatus } | null>
  generate: (id: number) => Promise<void>
  markGenerated: (id: number) => Promise<void>
  recordError: (id: number, cause: unknown) => Promise<void>
}

export interface ImagePipeline {
  run: (logId: number) => Promise<PipelineOutcome>
}

export const createImagePipeline = (deps: PipelineDeps): ImagePipeline => ({
  async run(logId) {
    const status = await deps.loadStatus(logId)

    if (!status) {
      return { kind: 'skipped', logId, reason: 'not-found' }
    }

    if (status.status !== LogStatus.Created) {
      return { kind: 'skipped', logId, reason: 'not-pending' }
    }

    let cause: unknown
    try {
      await deps.generate(logId)
      await deps.markGenerated(logId)
      return { kind: 'success', logId }
    } catch (error) {
      cause = error
    }

    try {
      await deps.recordError(logId, cause)
      return { kind: 'failed-recorded', logId, cause }
    } catch (writeError) {
      return { kind: 'failed-write-also-failed', logId, cause, writeError }
    }
  },
})

const defaultLoadStatus: PipelineDeps['loadStatus'] = async (id) => {
  const [row] = await db.select({ status: log.status }).from(log).where(eq(log.id, id))
  if (!row) return null
  return { status: row.status as LogStatus }
}

const defaultGenerate: PipelineDeps['generate'] = async (logId) => {
  const [logEntry] = await db.select().from(log).where(eq(log.id, logId))

  if (!logEntry) {
    throw new Error('Log not found')
  }

  let imagePrompt: string
  if (logEntry.imageDescription) {
    imagePrompt = logEntry.imageDescription
  } else {
    const r = await storyForge.imagePrompt(logEntry.description)
    if (!r.ok) {
      // Preserve the AIError discriminator on `cause` so the pipeline's
      // recordError step can persist a meaningful classification.
      throw new Error(r.message || 'Image prompt generation failed', {
        cause: { kind: r.error },
      })
    }
    imagePrompt = r.value
  }

  const imageData = await generateImageBase64(imagePrompt)
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  await uploadToR2(buffer, logId)
}

const defaultMarkGenerated: PipelineDeps['markGenerated'] = async (id) => {
  await db.update(log).set({ status: LogStatus.ImageGenerated }).where(eq(log.id, id))
}

const defaultRecordError: PipelineDeps['recordError'] = async (id, cause) => {
  await db
    .update(log)
    .set({
      status: LogStatus.Error,
      error: cause instanceof Error ? cause.message : JSON.stringify(cause),
    })
    .where(eq(log.id, id))
}

export const createDefaultImagePipeline = (overrides: Partial<PipelineDeps> = {}): ImagePipeline =>
  createImagePipeline({
    loadStatus: overrides.loadStatus ?? defaultLoadStatus,
    generate: overrides.generate ?? defaultGenerate,
    markGenerated: overrides.markGenerated ?? defaultMarkGenerated,
    recordError: overrides.recordError ?? defaultRecordError,
  })

export const imagePipeline: ImagePipeline = createDefaultImagePipeline()

// Fire-and-forget observability helper for entry points that don't surface
// the outcome in their HTTP response (submit, edit-PUT). Keeps the spec's
// US1#2 promise — every entry point exhaustively switches on outcome.kind —
// even when the response shape is unchanged.
export const logPipelineOutcome = (outcome: PipelineOutcome, contextLabel: string): void => {
  switch (outcome.kind) {
    case 'success':
      return
    case 'skipped':
      logger.info(`${contextLabel}: pipeline skipped log ${outcome.logId} (${outcome.reason})`)
      return
    case 'failed-recorded':
      logger.error(`${contextLabel}: pipeline recorded an error for log ${outcome.logId}`, {
        cause: outcome.cause,
      })
      return
    case 'failed-write-also-failed':
      logger.error(
        `${contextLabel}: pipeline failed to write the error column for log ${outcome.logId}`,
        {
          cause: outcome.cause,
          writeError: outcome.writeError,
        },
      )
      return
    default:
      assertNever(outcome)
  }
}
