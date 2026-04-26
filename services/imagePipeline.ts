import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateImageBase64, generateImagePrompt } from '@/services/ai'
import { uploadToR2 } from '@/utils/cloudflare'

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

  const imagePrompt = logEntry.imageDescription ?? (await generateImagePrompt(logEntry.description))
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
