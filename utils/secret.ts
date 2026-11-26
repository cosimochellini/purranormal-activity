import { VALIDATION_MESSAGES } from '@/constants'

const SECRET_ERRORS: ReadonlySet<string> = new Set([
  VALIDATION_MESSAGES.SECRET_INVALID,
  VALIDATION_MESSAGES.SECRET_REQUIRED,
])

/**
 * Reads `secret` from a server function payload: a plain object or the
 * `FormData` of an upload. Anything else has no secret.
 */
export const readSecret = (data: unknown): string => {
  const value =
    data instanceof FormData
      ? data.get('secret')
      : typeof data === 'object' && data !== null
        ? (data as { secret?: unknown }).secret
        : undefined
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The secret-gate copy when `error` is a rejection from `secretMiddleware`,
 * `null` otherwise. Forms use it to show the message under the secret field.
 */
export const secretErrorMessage = (error: unknown): string | null =>
  error instanceof Error && SECRET_ERRORS.has(error.message) ? error.message : null
