import { getLogs } from '../../services/log'
import { InfiniteEvents, InfiniteEventsSkeleton } from './InfiniteEvents'

const LIMIT = 6 * 3

export async function EventsSection() {
  const logs = await getLogs({ skip: 0, limit: LIMIT })

  return <InfiniteEvents initialLogs={logs} initialLimit={LIMIT} />
}

export function EventsSectionSkeleton() {
  return <InfiniteEventsSkeleton count={LIMIT} />
}
