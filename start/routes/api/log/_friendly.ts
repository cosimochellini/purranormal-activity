import type { AIError } from '@/services/storyForge'

/**
 * Shared friendly-text helpers for /api/log/refine and /api/log/submit.
 * Two routes both turn AIResult error envelopes (and unexpected catch
 * exceptions) into user-visible copy. Keeping the mapping in one place
 * prevents drift — each route only declares the concrete strings it
 * uses (the imperatives differ slightly: refine = "questions for your
 * event"; submit = "your paranormal event").
 */

export interface FriendlyMessages {
  AI_UNAVAILABLE: string
  AI_UNEXPECTED_RESPONSE: string
  CONNECTION_ISSUE: string
  REQUEST_TIMEOUT: string
  GENERIC_FALLBACK: string
  /** Optional — refine has no DB write path so it omits this. */
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
 * True iff the message looks like a database error. Decoupled from the
 * message map so the matcher's "is this a DB error?" decision stays
 * separate from "do I have user-visible copy for it?".
 *
 * Token list is stack-specific (libsql/drizzle/turso/sqlite + the bare
 * `db` token with word boundaries) so it does NOT false-match harmless
 * narrative text like "User database of paranormal events".
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

/**
 * True iff the message looks like an AI-provider failure. Run BEFORE the
 * infra (timeout/network/fetch) matcher so a thrown OpenAI error whose
 * message contains the literal token `fetch failed` (the most common
 * undici surface) is attributed to the AI service, not to the user's
 * connection.
 */
const looksLikeAiError = (message: string) => {
  const msg = lower(message)
  return msg.includes('openai') || msg.includes('rate limit') || /\bgpt-/.test(msg)
}

/**
 * Map a structured AIResult error to user-facing copy.
 * `parse` / `validation` → "AI returned an unexpected response".
 * `model` → first try matching the underlying message against
 *           timeout/network/fetch patterns, then fall back to the generic
 *           "AI temporarily unavailable" copy.
 */
export const friendlyAiErrorText = (
  kind: AIError,
  message: string,
  m: FriendlyMessages,
): string => {
  if (kind === 'parse' || kind === 'validation') return m.AI_UNEXPECTED_RESPONSE
  return matchInfraMessage(message, m) ?? m.AI_UNAVAILABLE
}

/**
 * Map an unexpected thrown exception's message to user-facing copy.
 *
 * Order:
 *   1. AI-provider tokens (OpenAI / rate limit / gpt-) — first, because
 *      `Error: fetch failed` is the most common OpenAI surface from the
 *      undici client and would otherwise be mis-routed to "Connection
 *      issue" copy.
 *   2. DB tokens (libsql/drizzle/turso/sqlite/`db`/`database <error>`).
 *   3. Generic infra tokens (timeout/network/fetch).
 *   4. Generic fallback.
 *
 * The bare `AI` substring is intentionally NOT used here — it
 * false-matches common words like `FAILED`, `AVAILABLE`, `MAIN`.
 */
export const friendlyCatchText = (message: string, m: FriendlyMessages): string => {
  if (looksLikeAiError(message)) return m.AI_UNAVAILABLE
  if (looksLikeDbError(message)) return m.DB_UNAVAILABLE ?? m.GENERIC_FALLBACK
  const infra = matchInfraMessage(message, m)
  if (infra) return infra
  return m.GENERIC_FALLBACK
}
