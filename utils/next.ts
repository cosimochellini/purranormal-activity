import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { NEXT_PUBLIC_APP_URL } from '../env/next'
import { redeploy } from './cloudflare'
import { logger } from './logger'

const triggerUrl = `${NEXT_PUBLIC_APP_URL}/api/trigger/images` as const
const triggerImages = () => fetch(triggerUrl, { method: 'POST' })

export function regenerateContents() {
  after(async () => {
    revalidatePath('/', 'layout')

    logger.info(`Triggering image generation at ${triggerUrl}`)

    await triggerImages()
      .then(logger.info)
      .catch(logger.error)

    await redeploy()
      .then(logger.info)
      .catch(logger.error)
  })
}
