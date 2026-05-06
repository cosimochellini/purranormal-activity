import type { AIError, AIResult } from '@/services/storyForge'

/**
 * Per-route error reporter for /api/log/* handlers.
 *
 * Two responsibilities, two layers:
 *
 *   1. `friendlyCopy(messages)` — pure classification: turns either an
 *      `AIResult` error envelope or an arbitrary thrown value into a
 *      user-visible string from the supplied `FriendlyMessages` map.
 *   2. `createFriendly<TResponse>(config)` — route-side ergonomics:
 *      wraps a handler body, catches throws, runs `error.name`
 *      enrichment, slots the friendly text into the route's
 *      response shape, and invokes the optional `onError` hook.
 *
 * The asymmetric matcher ordering (DB-first for `AIResult.model`,
 * AI-first for thrown values) is encoded once inside `friendlyCopy`
 * and never picked by a caller.
 */

export interface FriendlyMessages {
  AI_UNAVAILABLE: string
  AI_UNEXPECTED_RESPONSE: string
  CONNECTION_ISSUE: string
  REQUEST_TIMEOUT: string
  GENERIC_FALLBACK: string
  /** Optional — omit on routes with no DB write path (e.g. refine). */
  DB_UNAVAILABLE?: string
}

const lower = (message: string) => message.toLowerCase()

const matchInfraMessage = (message: string, m: FriendlyMessages) => {
  const msg = lower(message)
  if (msg.includes('timeout')) return m.REQUEST_TIMEOUT
  if (msg.includes('network') || msg.includes('fetch')) return m.CONNECTION_ISSUE
  return null
}

/**
 * Token list is stack-specific (libsql/drizzle/turso/sqlite + the bare
 * `db` token with word boundaries, plus the phrase `database <verb>`)
 * so it does NOT false-match harmless narrative text like "User
 * database of paranormal events".
 */
const looksLikeDbError = (message: string) => {
  const msg = lower(message)
  return (
    msg.includes('libsql') ||
    msg.includes('drizzle') ||
    msg.includes('turso') ||
    msg.includes('sqlite') ||
    /\bdb\b/.test(msg) ||
    /database\s+(error|connection|unavailable|down|timeout|connect|locked)/.test(msg)
  )
}

const looksLikeAiError = (message: string) => {
  const msg = lower(message)
  return msg.includes('openai') || msg.includes('rate limit') || /\bgpt-/.test(msg)
}

/**
 * `error.name`-prefix enrichment for bland undici surfaces. Without
 * this, a thrown `OpenAIError` whose message is just `"fetch failed"`
 * would be mis-attributed to the user's connection by the infra
 * matcher rather than to the LLM provider.
 */
const enrichErrorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

export interface FriendlyCopy {
  /**
   * Map a structured AIResult error envelope to user-facing copy.
   *
   * Order for `kind === 'model'`:
   *   1. DB tokens → DB_UNAVAILABLE (or GENERIC_FALLBACK when omitted).
   *   2. Infra tokens (timeout/network/fetch) → REQUEST_TIMEOUT / CONNECTION_ISSUE.
   *   3. Generic AI_UNAVAILABLE fallback.
   *
   * `parse` / `validation` always map to AI_UNEXPECTED_RESPONSE.
   *
   * The DB-first ordering is intentional: domain methods returning
   * `AIResult` fold their `categories.all()` (DB) failures under the
   * same `model` envelope, so a DB-shaped message is almost certainly
   * the categories port, not the LLM.
   */
  fromAiResult: (kind: AIError, message: string) => string

  /**
   * Map an arbitrary thrown value to user-facing copy.
   *
   * Order:
   *   1. AI tokens (openai / rate limit / gpt-) — first, because
   *      `OpenAIError: fetch failed` would otherwise be mis-routed to
   *      the connection-issue copy by the infra matcher.
   *   2. DB tokens.
   *   3. Infra tokens.
   *   4. Generic fallback.
   *
   * Accepts non-Error values without crashing — `null`, `undefined`,
   * and arbitrary primitives all coerce safely to strings before
   * matching.
   */
  fromThrown: (error: unknown) => string
}

export const friendlyCopy = (m: FriendlyMessages): FriendlyCopy => ({
  fromAiResult: (kind, message) => {
    if (kind === 'parse' || kind === 'validation') return m.AI_UNEXPECTED_RESPONSE
    if (looksLikeDbError(message)) return m.DB_UNAVAILABLE ?? m.GENERIC_FALLBACK
    return matchInfraMessage(message, m) ?? m.AI_UNAVAILABLE
  },
  fromThrown: (error) => {
    const message = enrichErrorMessage(error)
    if (looksLikeAiError(message)) return m.AI_UNAVAILABLE
    if (looksLikeDbError(message)) return m.DB_UNAVAILABLE ?? m.GENERIC_FALLBACK
    return matchInfraMessage(message, m) ?? m.GENERIC_FALLBACK
  },
})

export interface FriendlyConfig<TResponse> {
  messages: FriendlyMessages
  /** Slot the friendly string into the route's response shape. Bound once per route. */
  build: (text: string) => TResponse
  /**
   * Optional hook invoked exactly once whenever the reporter produces an
   * error response — both on caught throws (from `guard`) and on
   * AIResult `!ok` envelopes (from `fromAi`). Defaults to no-op.
   * Receives the original error/envelope and the rendered friendly text.
   */
  onError?: (error: unknown, friendly: string) => void
}

export interface FriendlyReporter<TResponse> {
  /**
   * Wraps a handler body. Returns the body's resolved value on success.
   * On a throw: catches the error, classifies its message via
   * `friendlyCopy.fromThrown`, calls `onError`, and returns
   * `build(friendlyText)`.
   *
   * NOTE: This silently converts thrown errors into a "successful"
   * `200 + { success: false, errors: ... }` envelope. Callers that
   * need a 5xx must opt out by handling the throw themselves.
   */
  guard: (run: () => Promise<TResponse>) => Promise<TResponse>

  /**
   * Branches on an AIResult. On `ok: true`, returns the unwrapped value.
   * On `ok: false`, returns a built error response and invokes
   * `onError`. Throws are NOT caught here — wrap with `guard`.
   */
  fromAi: <T>(result: AIResult<T>) => { ok: true; value: T } | { ok: false; response: TResponse }

  /**
   * Synchronous escape hatch for routes that don't want `guard`'s
   * promise-based catch behaviour. Same classification + `onError` as
   * the catch path of `guard`.
   */
  fromThrow: (error: unknown) => TResponse
}

export const createFriendly = <TResponse>(
  cfg: FriendlyConfig<TResponse>,
): FriendlyReporter<TResponse> => {
  const copy = friendlyCopy(cfg.messages)

  const handleThrow = (error: unknown): TResponse => {
    const text = copy.fromThrown(error)
    cfg.onError?.(error, text)
    return cfg.build(text)
  }

  return {
    guard: async (run) => {
      try {
        return await run()
      } catch (error) {
        return handleThrow(error)
      }
    },
    fromAi: (result) => {
      if (result.ok) return { ok: true, value: result.value }
      const text = copy.fromAiResult(result.error, result.message)
      cfg.onError?.(result, text)
      return { ok: false, response: cfg.build(text) }
    },
    fromThrow: handleThrow,
  }
}
