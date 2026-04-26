/**
 * Single logging surface for the project. Production code MUST NOT use
 * `console.*` directly (see constitution principle V — Observability).
 *
 * Today this is a thin wrapper over `console`, but routing every call through
 * this module means we can swap in a structured logger (pino, etc.) later
 * without touching every caller.
 */
export interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

export const logger: Logger = {
  log: (...args: unknown[]) => console.log(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => console.debug(...args),
}
