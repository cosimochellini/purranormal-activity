import type { ZodType } from 'zod'
import type { AIResult } from '@/services/storyForge'
import type { FriendlyReporter } from '@/start/routes/api/log/_friendly'
import { ok } from '@/utils/http'
import type { InvalidationTag } from '@/utils/invalidation'
import { createScopedLogger, type Logger, type LoggerSink } from '@/utils/logger'

/**
 * Typed API-route envelope.
 *
 * `defineHandlers(config)` builds the `handlers` object consumed by
 * `createFileRoute(...).server.handlers`. It owns the per-method:
 *
 *   1. Lazy read of declared slots — `request.json()` for body,
 *      `URL.searchParams` for query, the route's `params` object for params.
 *      A method without `body` never reads JSON.
 *   2. `safeParseAsync` per slot. Failures across slots are merged into one
 *      flat `ValidationFailure` (`{ success: false, errors }`) — no slot
 *      prefixes, matching today's response shape.
 *   3. Bind a request-scoped `Logger` into `ctx.log` with `{ method, route }`.
 *      Route files no longer import the global `logger`.
 *   4. Invoke `handler(input, ctx)`. The return is either a `RouteResult`
 *      directly, or an `AIResult<RouteResult>` — the envelope unwraps both:
 *        - `AIResult.ok=true`  → unwrap `.value` as the `RouteResult`.
 *        - `AIResult.ok=false` → route through `reporter.fromAi(...)` and
 *          return its `Response` verbatim.
 *   5. Catch any throw → `reporter.guard`'s fromThrown path → return the
 *      reporter's `Response`.
 *   6. Build the success `Response` via `ok<T>(result.data, { invalidate })`.
 *
 * Handlers never see the `Response` constructor — `invalidate` is the only
 * response-shape extension surfaced via `RouteResult`.
 */

export interface ValidationFailure {
  success: false
  errors: Record<string, string[]>
}

export interface RouteResult<TData> {
  data: TData
  invalidate?: readonly InvalidationTag[]
}

export interface RouteContext {
  request: Request
  params: Record<string, string>
  log: Logger
}

/**
 * Per-method config. The schema slots drive input inference: a method
 * without a `body` schema gets `body: undefined` in the handler input.
 * `TData` is the success payload type wrapped by the envelope's `ok()`.
 *
 * The handler return type is the union `RouteResult<TData> |
 * AIResult<RouteResult<TData>>` — a single Promise of either shape — so
 * handlers can branch and return mixed shapes (an AI failure passed through
 * bare, plus normal `{ data, invalidate? }` returns).
 */
export interface MethodConfig<
  TBody = undefined,
  TQuery = undefined,
  TParams = undefined,
  TData = unknown,
> {
  body?: ZodType<TBody>
  query?: ZodType<TQuery>
  params?: ZodType<TParams>
  reporter: FriendlyReporter<Response>
  handler: (
    input: { body: TBody; query: TQuery; params: TParams },
    ctx: RouteContext,
  ) => Promise<RouteResult<TData> | AIResult<RouteResult<TData>>>
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type FrameworkCtx = { request: Request; params: Record<string, string> }

export type Handlers = {
  [M in Method]?: (ctx: FrameworkCtx) => Promise<Response>
}

interface DefineHandlersOptions {
  /**
   * Optional sink for the request-scoped logger. Tests inject this to capture
   * log calls; production calls fall through to the global `console`-backed
   * `logger`.
   */
  loggerSink?: LoggerSink
  /**
   * Route id used as the `route` metadata on the scoped logger. Defaults to
   * `'unknown'` because TanStack's framework context does not surface the
   * route id on the handler invocation.
   */
  route?: string
}

/**
 * Identity helper: pins per-method generics from the supplied config without
 * the caller having to write explicit `MethodConfig<...>` type args. The
 * returned value is the same object, typed precisely.
 *
 * Use inside `defineHandlers({ POST: method({ body: schema, ... }) })` when
 * the handler body uses inferred `input.body` properties.
 */
export const method = <TBody = undefined, TQuery = undefined, TParams = undefined, TData = unknown>(
  config: MethodConfig<TBody, TQuery, TParams, TData>,
): MethodConfig<TBody, TQuery, TParams, TData> => config

type AnyConfigRuntime = {
  body?: ZodType<unknown>
  query?: ZodType<unknown>
  params?: ZodType<unknown>
  reporter: FriendlyReporter<Response>
  handler: (
    input: { body: unknown; query: unknown; params: unknown },
    ctx: RouteContext,
  ) => Promise<RouteResult<unknown> | AIResult<RouteResult<unknown>>>
}

const isAIResult = <T>(value: unknown): value is AIResult<T> => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { ok?: unknown }
  return v.ok === true || v.ok === false
}

const isRouteResult = (value: unknown): value is RouteResult<unknown> => {
  if (typeof value !== 'object' || value === null) return false
  return 'data' in (value as Record<string, unknown>)
}

const parseSlot = async <T>(
  schema: ZodType<T> | undefined,
  raw: unknown,
  errors: Record<string, string[]>,
): Promise<T> => {
  if (!schema) return undefined as T

  const result = await schema.safeParseAsync(raw)
  if (result.success) return result.data

  // Use `flatten().fieldErrors` for the merge so all slots share the same flat
  // shape today's routes already produce. `treeifyError` would nest keys.
  const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    if (!msgs || msgs.length === 0) continue
    const existing = errors[key] ?? []
    errors[key] = [...existing, ...msgs]
  }
  return undefined as T
}

const readBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    // Treat unreadable JSON as an empty body — schema validation will then
    // surface field-level errors for the missing required fields, which is
    // what today's hand-rolled envelope does (a `{}` parse on bad JSON).
    return {}
  }
}

const readQuery = (request: Request): Record<string, string> => {
  const { searchParams } = new URL(request.url)
  return Object.fromEntries(searchParams)
}

// Per-method type-checking is done by `MethodConfig<TBody, TQuery, TParams,
// TData>`; `defineHandlers` accepts any partial map of method configs. The
// caller pins per-method generics by using the `method()` helper below, or
// by letting TS infer through the schema → handler-input → return-type
// chain inside a single literal.
type ConfigMap = Partial<{
  [M in Method]: MethodConfig<any, any, any, any>
}>

export const defineHandlers = <C extends ConfigMap>(
  config: C,
  options: DefineHandlersOptions = {},
): { [M in keyof C & Method]: (ctx: FrameworkCtx) => Promise<Response> } => {
  const handlers = {} as { [M in keyof C & Method]: (ctx: FrameworkCtx) => Promise<Response> }
  const routeId = options.route ?? 'unknown'

  for (const [method, methodConfigRaw] of Object.entries(config) as Array<
    [Method, AnyConfigRuntime | undefined]
  >) {
    if (!methodConfigRaw) continue
    const methodConfig = methodConfigRaw

    const handler = (ctx: FrameworkCtx) =>
      methodConfig.reporter.guard(async () => {
        const log = createScopedLogger({ method, route: routeId }, options.loggerSink)

        const errors: Record<string, string[]> = {}

        // Read slots lazily: a method without `body` never invokes
        // `request.json()`. Same for query / params.
        const rawBody = methodConfig.body ? await readBody(ctx.request) : undefined
        const rawQuery = methodConfig.query ? readQuery(ctx.request) : undefined
        const rawParams = methodConfig.params ? (ctx.params ?? {}) : undefined

        const parsedBody = await parseSlot(methodConfig.body, rawBody, errors)
        const parsedQuery = await parseSlot(methodConfig.query, rawQuery, errors)
        const parsedParams = await parseSlot(methodConfig.params, rawParams, errors)

        if (Object.keys(errors).length > 0) {
          const failure: ValidationFailure = { success: false, errors }
          return ok(failure)
        }

        const input = { body: parsedBody, query: parsedQuery, params: parsedParams }
        const routeCtx: RouteContext = {
          request: ctx.request,
          params: ctx.params ?? {},
          log,
        }

        const handlerResult = await methodConfig.handler(input, routeCtx)

        // Discriminate AIResult vs RouteResult by shape. `AIResult` has a
        // boolean `ok`; `RouteResult` has `data`. A handler that returns an
        // `AIResult` whose `.value` is a `RouteResult` is the canonical
        // "pass-through" path the RFC calls out.
        if (isAIResult<RouteResult<unknown>>(handlerResult) && !isRouteResult(handlerResult)) {
          if (handlerResult.ok) {
            const inner = handlerResult.value
            return ok(inner.data, inner.invalidate ? { invalidate: inner.invalidate } : undefined)
          }
          const ai = methodConfig.reporter.fromAi(handlerResult)
          // `fromAi(!ok)` always returns `{ ok: false, response }` here.
          if (!ai.ok) return ai.response
          // Defensive: an `ok` branch here would mean the reporter accepted a
          // success envelope, but we only reach this branch when `ok=false`.
          /* c8 ignore next */
          return ok(ai.value as RouteResult<unknown>['data'])
        }

        const routeResult = handlerResult as RouteResult<unknown>
        return ok(
          routeResult.data,
          routeResult.invalidate ? { invalidate: routeResult.invalidate } : undefined,
        )
      })

    // Cast: the runtime map is keyed by `Method` but the public return type is
    // narrowed to the methods present in `C`. The runtime assignment is a
    // subset of the declared shape.
    ;(handlers as Record<Method, (ctx: FrameworkCtx) => Promise<Response>>)[method] = handler
  }

  return handlers
}
