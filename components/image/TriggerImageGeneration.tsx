'use client'
import { useEffect, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import type { LogWithCategories } from '../../db/schema'
import { CLOUDFLARE_DEPLOY_URL } from '../../env/cloudflare'
import { fetcher } from '../../utils/fetch'
import { Refetch } from '../timer/refetch'

interface TriggerImageGenerationProps {
  log: LogWithCategories
}

const triggerGeneration = fetcher<never, never, never>('/api/trigger/[id]', 'POST')
const triggerDeployment = fetcher<never, never, never>(CLOUDFLARE_DEPLOY_URL, 'POST')

export function TriggerImageGeneration({ log }: TriggerImageGenerationProps) {
  const [shouldRefetch, setShouldRefetch] = useState(false)

  useEffect(() => {
    if (log.status !== LogStatus.Created) return

    Promise.all([triggerGeneration({ params: { id: log.id } }), triggerDeployment()]).then(() =>
      setShouldRefetch(true),
    )
  }, [log])

  return <Refetch interval={500} shouldRefetch={shouldRefetch} />
}
