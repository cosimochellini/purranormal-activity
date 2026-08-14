import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MAX_ATTEMPTS,
  MAX_DELIVERIES,
  QUEUE_NAMES,
  RETRY_DELAY_SECONDS,
  SWEEP_STALE_MS,
} from './config'

// Queue names and retry counts live as bare strings/numbers in BOTH
// `wrangler.jsonc` and `config.ts`. Nothing in the type system couples them, so
// this suite is the coupling: a rename or a bumped `max_retries` that only
// lands in one file fails here instead of silently misrouting dead letters or
// mis-terminating retries in production.
const wranglerConfig = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')

describe('queue config agrees with wrangler.jsonc', () => {
  it('declares the main queue under the name the consumer branches on', () => {
    expect(wranglerConfig).toContain(`"queue": "${QUEUE_NAMES.main}"`)
    expect(wranglerConfig).toContain(`"binding": "IMAGE_QUEUE"`)
  })

  it('declares the dead-letter queue under the name the consumer branches on', () => {
    expect(wranglerConfig).toContain(`"dead_letter_queue": "${QUEUE_NAMES.deadLetter}"`)
    expect(wranglerConfig).toContain(`"queue": "${QUEUE_NAMES.deadLetter}"`)
  })

  it('sets max_retries so that deliveries === MAX_DELIVERIES', () => {
    expect(wranglerConfig).toContain(`"max_retries": ${MAX_DELIVERIES - 1}`)
  })

  it('sets retry_delay to RETRY_DELAY_SECONDS', () => {
    expect(wranglerConfig).toContain(`"retry_delay": ${RETRY_DELAY_SECONDS}`)
  })

  it('registers the cron trigger the sweeper depends on', () => {
    expect(wranglerConfig).toMatch(/"crons":\s*\[\s*"\*\/5 \* \* \* \*"\s*\]/)
  })

  it('points main at the worker entry that exports queue and scheduled', () => {
    // `main` — not the mere existence of `start/server.ts` — decides what the
    // deployed worker exports.
    expect(wranglerConfig).toContain('"main": "./start/server.ts"')
  })
})

describe('queue config internal invariants', () => {
  it('grants exactly one retry', () => {
    expect(MAX_ATTEMPTS).toBe(2)
    expect(MAX_DELIVERIES).toBe(MAX_ATTEMPTS)
  })

  it('keeps the staleness lease well clear of the retry delay', () => {
    // The sweeper cannot distinguish "in flight" from "lost", so the lease has
    // to outlast a retry delay plus a full generation, or it re-enqueues rows
    // that are merely waiting.
    expect(SWEEP_STALE_MS).toBeGreaterThan(RETRY_DELAY_SECONDS * 1000 * 4)
  })
})
