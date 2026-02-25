import { setLogError } from '@/services/log'
import { triggerFirstPendingImage, triggerLogImageIfPending } from '@/services/trigger'
import { logger } from '@/utils/logger'

// Framework-neutral placeholder for cache invalidation during migration.
export async function invalidatePublicContent() {
  logger.info('Content invalidation requested (currently no-op)')
}

interface RegenerateContentsOptions {
  triggerImages?: boolean
  triggerLogId?: number
}

interface RegenerateContentsResult {
  imageTriggered: boolean
}

export async function regenerateContents({
  triggerImages = true,
  triggerLogId,
}: RegenerateContentsOptions = {}) {
  await invalidatePublicContent()

  if (!triggerImages) {
    return { imageTriggered: false } satisfies RegenerateContentsResult
  }

  try {
    if (typeof triggerLogId === 'number' && Number.isFinite(triggerLogId)) {
      const triggered = await triggerLogImageIfPending(triggerLogId)

      if (triggered) {
        return { imageTriggered: true } satisfies RegenerateContentsResult
      }
    }

    const triggered = await triggerFirstPendingImage()

    if (!triggered && typeof triggerLogId === 'number' && Number.isFinite(triggerLogId)) {
      const error = new Error(`Image generation was not triggered for log ${triggerLogId}`)
      logger.error(error.message)
      await setLogError(triggerLogId, error)
    }

    return { imageTriggered: triggered } satisfies RegenerateContentsResult
  } catch (error) {
    logger.error('Failed to trigger image generation during content regeneration:', error)

    if (typeof triggerLogId === 'number' && Number.isFinite(triggerLogId)) {
      await setLogError(triggerLogId, error)
    }

    return { imageTriggered: false } satisfies RegenerateContentsResult
  }
}
