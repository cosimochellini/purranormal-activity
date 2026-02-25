'use client'
import { useEffect, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import type { LogWithCategories } from '../../db/schema'
import { fetcher } from '../../utils/fetch'
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
      .catch(() => null)
      .then(() => setShouldRefetch(true))
  }, [log])

  return <Refetch interval={500} shouldRefetch={shouldRefetch} />
}
