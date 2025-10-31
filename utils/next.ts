import { revalidatePath } from 'next/cache'
import { NEXT_PUBLIC_APP_URL } from '../env/next'
import { redeploy } from './cloudflare.server'
import { logger } from './logger'

const triggerUrl = `${NEXT_PUBLIC_APP_URL}/api/trigger/images` as const

export async function regenerateContents() {
  revalidatePath('/', 'layout')

  logger.info(`Triggering image generation at ${triggerUrl}`)

  await redeploy().then(logger.info).catch(logger.error)
}
