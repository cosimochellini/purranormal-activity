import { useEffect } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import type { LogWithCategories } from '../../db/schema'
import { fetcher } from '../../utils/fetch'
import { logger } from '../../utils/logger'

interface TriggerImageGenerationProps {
  log: LogWithCategories
}

const triggerGeneration = fetcher<never, never, never>('/api/trigger/[id]', 'POST')

export function TriggerImageGeneration({ log }: TriggerImageGenerationProps) {
  useEffect(() => {
    if (log.status !== LogStatus.Created) return

    triggerGeneration({ params: { id: log.id } }).catch((error) => {
      logger.error('Failed to trigger image generation:', error)
    })
  }, [log])

  return null
}
