import { Await, CatchBoundary, getRouteApi } from '@tanstack/react-router'
import { Loading } from '../common/Loading'
import { EventCard } from '../events/EventCard'
import { NoLogsFound } from './NoLogsFound'

const route = getRouteApi('/explore')

function ResultsError() {
  return (
    <p role="alert" className="py-12 text-center text-purple-200/80">
      The archives are unreachable right now. Change a filter or try again in a moment.
    </p>
  )
}

export function ExploreResults() {
  const { results } = route.useLoaderData()

  // A failed page only replaces the results: the filters above stay mounted,
  // and the next search (a new promise) resets the boundary.
  return (
    <CatchBoundary getResetKey={() => results} errorComponent={ResultsError}>
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
    </CatchBoundary>
  )
}
