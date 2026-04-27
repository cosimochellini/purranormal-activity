import { LogStatus } from '@/data/enum/logStatus'
import { causeToErrorString, NO_FAILURE, type PipelineOutcome } from './outcome'
import type { ImagePipeline, PipelineDeps, SubmitInput, SubmitResult } from './ports'

// Decode the base64 image payload returned by AI image models. Workers
// expose a global `atob`; we keep this conversion in the orchestrator
// (out of the storage adapter) so swapping to a different store does
// not reinvent it. The `data:image/...;base64,` prefix from some
// providers is stripped here.
const decodeBase64 = (payload: string): Uint8Array => {
  const stripped = payload.replace(/^data:image\/\w+;base64,/, '')
  const binary = atob(stripped)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const runGeneration = async (deps: PipelineDeps, logId: number): Promise<void> => {
  const row = await deps.repo.findById(logId)
  if (!row) {
    throw new Error('Log not found')
  }

  let imagePrompt: string
  if (row.imageDescription) {
    imagePrompt = row.imageDescription
  } else {
    const result = await deps.aiText.imagePrompt(row.description)
    if (!result.ok) {
      // Preserve the AIError discriminator on `cause` so recordError
      // persists a meaningful classification.
      throw new Error(result.message || 'Image prompt generation failed', {
        cause: { kind: result.error },
      })
    }
    imagePrompt = result.value
  }

  const base64 = await deps.aiImage.generateBase64(imagePrompt)
  const bytes = decodeBase64(base64)

  await deps.store.put(logId, bytes)
  await deps.repo.markImageGenerated(logId)
}

const recordFailure = async (
  deps: PipelineDeps,
  logId: number,
  cause: unknown,
): Promise<PipelineOutcome> => {
  try {
    await deps.repo.markError(logId, causeToErrorString(cause))
    return { kind: 'failed-recorded', logId, cause }
  } catch (writeError) {
    return { kind: 'failed-write-also-failed', logId, cause, writeError }
  }
}

export const createImagePipeline = (deps: PipelineDeps): ImagePipeline => {
  const generateImageFor = async (logId: number): Promise<PipelineOutcome> => {
    let cause: unknown = NO_FAILURE
    let status: { status: LogStatus } | null = null

    try {
      status = await deps.repo.loadStatus(logId)
    } catch (error) {
      // loadStatus throwing means we cannot determine whether the row
      // exists or what state it's in. Best-effort: try to record the
      // error on the assumed-existing row; fall back to
      // failed-write-also-failed if that write also fails.
      cause = error
    }

    if (cause === NO_FAILURE) {
      if (!status) return { kind: 'skipped', logId, reason: 'not-found' }
      if (status.status !== LogStatus.Created) {
        return { kind: 'skipped', logId, reason: 'not-pending' }
      }

      try {
        await runGeneration(deps, logId)
        return { kind: 'success', logId }
      } catch (error) {
        cause = error
      }
    }

    return recordFailure(deps, logId, cause)
  }

  const submit = async (input: SubmitInput): Promise<SubmitResult> => {
    const { id } = await deps.repo.insertDraft(input.draft)

    let cause: unknown = NO_FAILURE
    try {
      await deps.repo.linkCategories(id, input.categoryIds)
    } catch (error) {
      cause = error
    }

    if (cause === NO_FAILURE) {
      try {
        await runGeneration(deps, id)
        return { id, outcome: { kind: 'success', logId: id } }
      } catch (error) {
        cause = error
      }
    }

    const outcome = await recordFailure(deps, id, cause)
    return { id, outcome }
  }

  const drainOnePending = async (): Promise<PipelineOutcome | null> => {
    const row = await deps.repo.findFirstPending()
    if (!row) return null
    return generateImageFor(row.id)
  }

  return { submit, generateImageFor, drainOnePending }
}
