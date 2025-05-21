'use client'
import { useEffect, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import type { LogWithCategories } from '../../db/schema'
import { NEXT_PUBLIC_APP_URL } from '../../env/next'
import { fetcher } from '../../utils/fetch'
import { Refetch } from '../timer/refetch'

interface TriggerImageGenerationProps {
  log: LogWithCategories
}

const triggerGeneration = fetcher<never, never, never>('/api/trigger/[id]', 'POST')
const triggerUrl = fetcher<never, never, never>(`${NEXT_PUBLIC_APP_URL}/api/trigger/images`, 'POST')

export function TriggerImageGeneration({ log }: TriggerImageGenerationProps) {
  const [shouldRefetch, setShouldRefetch] = useState(false)

  useEffect(() => {
    if (log.status !== LogStatus.Created) return

    Promise.all([triggerGeneration({ params: { id: log.id } }), triggerUrl()]).then(() =>
      setShouldRefetch(true),
    )
  }, [log])

  return <Refetch interval={500} shouldRefetch={shouldRefetch} />
}
