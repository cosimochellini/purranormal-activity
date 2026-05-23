/**
 * Single logging surface for the project. Production code MUST NOT use
 * `console.*` directly (see constitution principle V — Observability).
 *
 * Today this is a thin wrapper over `console`, but routing every call through
 * this module means we can swap in a structured logger (pino, etc.) later
 * without touching every caller.
 *
 * Scoped loggers (`createScopedLogger`) bind a metadata bag (today: method +
 * route) that is prepended to every log line. The route envelope
 * (`services/route/defineHandlers.ts`) uses this so route handlers no longer
 * import the global `logger` directly — swapping in pino with correlation IDs
 * becomes a one-file change inside `createScopedLogger`.
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

export interface ScopedLoggerMeta {
  method: string
  route: string
}

export type LoggerSink = (level: keyof Logger, meta: ScopedLoggerMeta, args: unknown[]) => void

const defaultSink: LoggerSink = (level, meta, args) => {
  logger[level](meta, ...args)
}

/**
 * Build a per-request scoped logger that prepends `{ method, route }` to
 * every line. Tests may inject a `sink` to capture log calls instead of
 * routing through the global `console`-backed logger.
 */
export const createScopedLogger = (
  meta: ScopedLoggerMeta,
  sink: LoggerSink = defaultSink,
): Logger => ({
  log: (...args) => sink('log', meta, args),
  info: (...args) => sink('info', meta, args),
  warn: (...args) => sink('warn', meta, args),
  error: (...args) => sink('error', meta, args),
  debug: (...args) => sink('debug', meta, args),
})
