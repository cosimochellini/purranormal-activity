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
  /** Optional — submit-only since refine has no DB write path. */
  DB_UNAVAILABLE?: string
}

const matchInfraMessage = (message: string, m: FriendlyMessages) => {
  if (message.includes('timeout')) return m.REQUEST_TIMEOUT
  if (message.includes('network') || message.includes('fetch')) return m.CONNECTION_ISSUE
  return null
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
 * The bare `AI` substring is intentionally NOT used here — it false-matches
 * common words like `FAILED`, `AVAILABLE`, `MAIN`. Only the explicit
 * `OpenAI` token (or the structured AIResult path) signals an AI failure.
 */
export const friendlyCatchText = (message: string, m: FriendlyMessages): string => {
  if (m.DB_UNAVAILABLE && (message.includes('database') || message.includes('DB'))) {
    return m.DB_UNAVAILABLE
  }
  const infra = matchInfraMessage(message, m)
  if (infra) return infra
  if (message.includes('OpenAI')) return m.AI_UNAVAILABLE
  return m.GENERIC_FALLBACK
}
