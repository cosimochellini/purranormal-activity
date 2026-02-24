import { NEXT_PUBLIC_APP_URL } from '@/env/next'
import { redeploy } from '@/utils/cloudflare'
import { logger } from '@/utils/logger'

const triggerUrl = `${NEXT_PUBLIC_APP_URL}/api/trigger/images` as const

// Framework-neutral placeholder for cache invalidation during migration.
export async function invalidatePublicContent() {
  logger.info('Content invalidation requested (currently no-op)')
}

export async function regenerateContents() {
  await invalidatePublicContent()

  logger.info(`Triggering image generation at ${triggerUrl}`)

  await redeploy().then(logger.info).catch(logger.error)
}
