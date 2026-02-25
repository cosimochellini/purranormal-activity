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

export async function regenerateContents({
  triggerImages = true,
  triggerLogId,
}: RegenerateContentsOptions = {}) {
  await invalidatePublicContent()

  if (!triggerImages) {
    return
  }

  try {
    if (typeof triggerLogId === 'number' && Number.isFinite(triggerLogId)) {
      const triggered = await triggerLogImageIfPending(triggerLogId)

      if (triggered) {
        return
      }
    }

    await triggerFirstPendingImage()
  } catch (error) {
    logger.error('Failed to trigger image generation during content regeneration:', error)
  }
}
