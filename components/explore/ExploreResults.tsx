import { Await, getRouteApi } from '@tanstack/react-router'
import { Loading } from '../common/Loading'
import { EventCard } from '../events/EventCard'
import { NoLogsFound } from './NoLogsFound'

const route = getRouteApi('/explore')

export function ExploreResults() {
  const { results } = route.useLoaderData()

  return (
    <Await promise={results} fallback={<Loading />}>
      {({ logs }) =>
        logs.length === 0 ? (
          <NoLogsFound />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {logs.map((log, index) => (
              <EventCard key={log.id} log={log} priority={index < 1} />
            ))}
          </div>
        )
      }
    </Await>
  )
}
