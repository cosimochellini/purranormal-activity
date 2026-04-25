import { useEffect, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import type { LogWithCategories } from '../../db/schema'
import { fetcher } from '../../utils/fetch'
import { logger } from '../../utils/logger'
import { Refetch } from '../timer/refetch'

interface TriggerImageGenerationProps {
  log: LogWithCategories
}

const triggerGeneration = fetcher<never, never, never>('/api/trigger/[id]', 'POST')

export function TriggerImageGeneration({ log }: TriggerImageGenerationProps) {
  const [shouldRefetch, setShouldRefetch] = useState(false)

  useEffect(() => {
    if (log.status !== LogStatus.Created) return

    triggerGeneration({ params: { id: log.id } })
      .then(() => setShouldRefetch(true))
      .catch((error) => {
        logger.error('Failed to trigger image generation:', error)
      })
  }, [log])

  return <Refetch interval={500} shouldRefetch={shouldRefetch} />
}
