/**
 * Queue tuning knobs. Server-only by convention (never imported by a
 * component), so they live here rather than in the client-safe root
 * `constants.ts`.
 *
 * `MAX_ATTEMPTS` and the wrangler `max_retries` are two halves of one
 * decision: Cloudflare delivers a message `max_retries + 1` times, and the
 * pipeline grants a row `MAX_ATTEMPTS` claims. `config.test.ts` asserts the
 * two files agree — the only guard against silent drift between a JSON number
 * and a TS constant.
 */

/** Generation attempts per log row: 1 initial + 1 retry. */
export const MAX_ATTEMPTS = 2

/**
 * Deliveries Cloudflare makes for a single message (`max_retries + 1`).
 * Belt-and-braces: if the durable `attempts` counter ever fails to advance,
 * the last delivery is still treated as final instead of looping forever.
 */
export const MAX_DELIVERIES = 2

/** Delay before a retried message is redelivered. */
export const RETRY_DELAY_SECONDS = 30

/**
 * A `Created` row whose `updatedAt` is older than this is presumed lost (the
 * enqueue never landed, or the consumer died mid-flight). Must comfortably
 * exceed `RETRY_DELAY_SECONDS` plus a worst-case generation, otherwise the
 * sweeper re-enqueues rows that are merely waiting for their retry.
 */
export const SWEEP_STALE_MS = 10 * 60 * 1000

/** Rows the cron sweeper touches per run. Caps the OpenAI burst it can cause. */
export const SWEEP_LIMIT = 10

/** Rows `POST /api/script` enqueues per call. */
export const ENQUEUE_PENDING_LIMIT = 50

/** Queues caps `sendBatch` at 100 messages / 256 KB. */
export const MAX_SEND_BATCH = 100

/** MUST match `wrangler.jsonc` verbatim — asserted by `config.test.ts`. */
export const QUEUE_NAMES = {
  main: 'purranormal-image-jobs',
  deadLetter: 'purranormal-image-jobs-dlq',
} as const
