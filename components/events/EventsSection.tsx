import { getLogs } from '../../services/log'
import { InfiniteEvents, InfiniteEventsSkeleton } from './InfiniteEvents'

export async function EventsSection() {
  const logs = await getLogs(0, 6)

  return <InfiniteEvents initialLogs={logs} />
}

export function EventsSectionSkeleton() {
  return <InfiniteEventsSkeleton iconCount={6} />
}
