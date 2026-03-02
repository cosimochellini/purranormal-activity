import { useEffect, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import type { LogWithCategories } from '../../db/schema'
import type { TriggerIdResponse } from '../../types/api/trigger-id'
import { fetcher } from '../../utils/fetch'
import { Refetch } from '../timer/refetch'

interface TriggerImageGenerationProps {
  log: LogWithCategories
}

const triggerGeneration = fetcher<TriggerIdResponse, never, never>('/api/trigger/[id]', 'POST')

export function TriggerImageGeneration({ log }: TriggerImageGenerationProps) {
  const [shouldRefetch, setShouldRefetch] = useState(false)

  useEffect(() => {
    if (log.status !== LogStatus.Created) return

    triggerGeneration({ params: { id: log.id } })
      .catch(() => null)
      .then((response) => {
        if (!response) {
          setShouldRefetch(false)
          return
        }

        const shouldRefreshOnce =
          response.success || response.error.toLowerCase().includes('not needed')

        setShouldRefetch(shouldRefreshOnce)
      })
  }, [log.id, log.status])

  return <Refetch interval={500} shouldRefetch={shouldRefetch} />
}
