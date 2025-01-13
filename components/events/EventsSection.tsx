import { getLogs } from '../../services/log'
import { InfiniteEvents, InfiniteEventsSkeleton } from './InfiniteEvents'

export async function EventsSection() {
  const logs = await getLogs({ skip: 0, limit: 6 })

  return <InfiniteEvents initialLogs={logs} />
}

export function EventsSectionSkeleton() {
  return <InfiniteEventsSkeleton iconCount={6} />
}
