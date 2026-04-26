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
 */
const looksLikeDbError = (message: string) => {
  const msg = lower(message)
  return /\bdb\b/.test(msg) || msg.includes('database')
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
 * Order matters: infra (timeout/network) and DB checks run first because
 * those messages frequently include words like `failed` or `aborted`
 * which would false-match a too-broad AI matcher. The bare `AI`
 * substring is intentionally NOT used here — it false-matches common
 * words like `FAILED`, `AVAILABLE`, `MAIN`. Only the explicit `OpenAI`
 * token (or the structured AIResult path) signals an AI failure.
 */
export const friendlyCatchText = (message: string, m: FriendlyMessages): string => {
  const infra = matchInfraMessage(message, m)
  if (infra) return infra
  if (looksLikeDbError(message)) return m.DB_UNAVAILABLE ?? m.GENERIC_FALLBACK
  if (message.includes('OpenAI')) return m.AI_UNAVAILABLE
  return m.GENERIC_FALLBACK
}
