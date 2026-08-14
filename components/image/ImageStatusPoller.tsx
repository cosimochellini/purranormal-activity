import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { UI_CONFIG } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import { matchesTags } from '@/utils/invalidation'
import { logger } from '@/utils/logger'

interface ImageStatusPollerProps {
  log: LogWithCategories
}

/**
 * Delay for a given 1-based poll attempt. Backs off so a long generation (or a
 * failed first attempt plus its 30s retry delay) is still covered without
 * hammering the loader: 10 × 3s + 10 × 6s + 10 × 12s ≈ 3.5 minutes.
 */
const delayFor = (attempt: number): number => {
  if (attempt <= UI_CONFIG.POLL_FAST_ATTEMPTS) return UI_CONFIG.POLL_INTERVAL_MS
  if (attempt <= UI_CONFIG.POLL_FAST_ATTEMPTS * 2) return UI_CONFIG.POLL_INTERVAL_MS * 2
  return UI_CONFIG.POLL_INTERVAL_MS * 4
}

/**
 * Watches a pending log until its image lands.
 *
 * Generation happens on a Cloudflare Queue now, so no request the browser makes
 * carries the completion signal — this re-runs the route loader until the
 * status changes, then stops.
 *
 * Renders nothing.
 */
export function ImageStatusPoller({ log }: ImageStatusPollerProps) {
  const router = useRouter()
  // Held in a ref, not a dependency: a router whose identity changed would
  // restart the effect and hand the poll budget back, which is the difference
  // between a bounded watch and an endless one.
  const routerRef = useRef(router)
  routerRef.current = router

  const attempts = useRef(0)
  const { id, status } = log

  useEffect(() => {
    // Reset the budget whenever the watched row or its status actually changes:
    // a different log, or the same log put back into `Created` by an edit or an
    // operator retry, deserves a full set of polls.
    attempts.current = 0

    if (status !== LogStatus.Created) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const schedule = () => {
      if (cancelled || attempts.current >= UI_CONFIG.POLL_MAX_ATTEMPTS) return

      timer = setTimeout(
        () => {
          attempts.current += 1
          routerRef.current
            .invalidate({ filter: (match) => matchesTags(match, [`log:${id}`]) })
            .catch((error) => logger.error('Failed to poll image status:', error))
            // Keep polling even if one invalidation rejects — a transient loader
            // failure should not end the watch.
            .finally(schedule)
        },
        delayFor(attempts.current + 1),
      )
    }

    schedule()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // Primitive deps ONLY. Every successful `invalidate` produces a fresh
    // loaderData object, so depending on `log` would tear the timer down and
    // rebuild it on every poll — and reset the attempt budget, making this an
    // unbounded poll loop.
  }, [id, status])

  return null
}
