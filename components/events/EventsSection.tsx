import { getLogs } from '../../services/log'
import { InfiniteEvents, InfiniteEventsSkeleton } from './InfiniteEvents'

export async function EventsSection() {
  const logs = await getLogs({ skip: 0, limit: 6 })

  return <InfiniteEvents initialLogs={logs} initialLimit={6} />
}

export function EventsSectionSkeleton() {
  return <InfiniteEventsSkeleton count={6} />
}
