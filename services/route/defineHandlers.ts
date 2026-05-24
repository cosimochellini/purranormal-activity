import type { ZodType } from 'zod'
import * as z from 'zod'
import type { AIResult } from '@/services/storyForge'
import type { FriendlyReporter } from '@/start/routes/api/log/_friendly'
import { methodNotAllowed as methodNotAllowedResponse, ok } from '@/utils/http'
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
  /**
   * Methods that should respond with `405 Method Not Allowed` and an
   * `Allow:` header listing the active methods. TanStack Start does NOT emit
   * a default 405 — if a request hits a method without a handler, control
   * falls through to the page route. Listing methods here lets the envelope
   * own that response shape instead of forcing route files to hand-merge a
   * spread of envelope output plus extra entries.
   */
  methodNotAllowed?: readonly Method[]
}

/**
 * Identity helper: pins per-method generics from the supplied config without
 * the caller having to write explicit `MethodConfig<...>` type args. The
 * returned value is the same object, typed precisely.
 *
 * Use inside `defineHandlers({ POST: method({ body: schema, ... }) })` when
 * the handler body uses inferred `input.body` properties. This is the
 * supported route-author entry point — `defineHandlers` itself does not
 * attempt to infer per-method generics through its container literal
 * (TanStack Start's `handlers` shape is a fixed `Method → Function` map and
 * we don't try to thread the schemas through that container).
 */
export const method = <TBody = undefined, TQuery = undefined, TParams = undefined, TData = unknown>(
  config: MethodConfig<TBody, TQuery, TParams, TData>,
): MethodConfig<TBody, TQuery, TParams, TData> => config

// Runtime shape of a single method config — looser than the public
// `MethodConfig` so a precisely-typed `MethodConfig<TBody,...>` literal can
// be stored into this map without TS rejecting the contravariant handler
// input. We never expose this type to route authors; it exists only for
// the internal `for...of` loop below.
//
// `handler` is declared with method-shorthand syntax (`handler(...)`) so its
// parameter is checked bivariantly even under `strictFunctionTypes`. That
// lets `MethodConfig<TBody,TQuery,TParams,TData>` (whose handler parameter
// narrows `body`/`query`/`params` to TBody/TQuery/TParams) be assignable to
// this runtime shape — without introducing `any` anywhere.
interface RuntimeMethodConfig {
  body?: ZodType<unknown>
  query?: ZodType<unknown>
  params?: ZodType<unknown>
  reporter: FriendlyReporter<Response>
  handler(
    input: { body: unknown; query: unknown; params: unknown },
    ctx: RouteContext,
  ): Promise<unknown>
}

type ConfigMapInternal = Partial<Record<Method, RuntimeMethodConfig>>

const isAIResult = <T>(value: unknown): value is AIResult<T> => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { ok?: unknown; value?: unknown; error?: unknown; message?: unknown }
  // `ok: true` requires a `value` field; `ok: false` requires `error` + `message`.
  // This rejects accidental shapes like `{ ok: true, value: ... }` from a handler
  // that meant `{ data: ... }` only if the value happens to lack the AI-error
  // co-fields — but a literal `{ ok: false, error, message }` IS an AIResult and
  // must be passed through. The footgun coverage in the tests pins this.
  if (v.ok === true) return 'value' in (value as object)
  if (v.ok === false) return typeof v.error === 'string' && typeof v.message === 'string'
  return false
}

const isRouteResult = (value: unknown): value is RouteResult<unknown> => {
  if (typeof value !== 'object' || value === null) return false
  return 'data' in (value as Record<string, unknown>)
}

/**
 * Reshape `treeifyError(zodErr).properties` into the flat
 * `{ [field]: string[] }` shape the routes expose. Top-level array failures
 * (e.g. `answers` rejected as a whole) surface as `{ answers: [] }`-style
 * entries because `properties[key].errors` is the array of issues *at* that
 * key — nested-array element issues live under `items[*]` and are
 * intentionally NOT hoisted, matching the pre-refactor route handlers.
 *
 * Defensive: if `treeifyError` ever returns a shape without `.properties`
 * (zod major-version drift, mocked test value), the function returns `{}`
 * instead of throwing.
 */
const reshapeZodErrors = (
  zodErr: Parameters<typeof z.treeifyError>[0],
): Record<string, string[]> => {
  const tree = z.treeifyError(zodErr) as {
    properties?: Record<string, { errors?: string[] } | undefined>
  }
  const properties = tree?.properties
  if (!properties || typeof properties !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(properties)) {
    out[key] = value?.errors ?? []
  }
  return out
}

const mergeFieldErrors = (
  target: Record<string, string[]>,
  source: Record<string, string[]>,
): void => {
  for (const [key, msgs] of Object.entries(source)) {
    if (!msgs || msgs.length === 0) {
      // Preserve the empty-array signal — pre-refactor produced `{ answers: [] }`
      // for nested-array failures on the `submit` route. Don't drop it.
      if (!(key in target)) target[key] = []
      continue
    }
    const existing = target[key] ?? []
    // Concatenate + dedupe so cross-slot collisions (e.g. body.id AND
    // params.id both failing) surface every distinct message under one key.
    target[key] = Array.from(new Set([...existing, ...msgs]))
  }
}

// Sentinel key the envelope uses to mark a slot as failed when
// `reshapeZodErrors` returns no field-keyed messages (root-level / primitive
// schemas, or `treeifyError` drift). Without this, `Object.keys(errors)`
// would be empty and the envelope would advance past validation as if the
// slot parsed successfully.
const FAILED_SLOT_SENTINEL = '__envelope_slot_failed__'

const parseSlot = async <T>(
  schema: ZodType<T> | undefined,
  raw: unknown,
  errors: Record<string, string[]>,
): Promise<T> => {
  if (!schema) return undefined as T

  const result = await schema.safeParseAsync(raw)
  if (result.success) return result.data

  const fieldErrors = reshapeZodErrors(result.error)
  if (Object.keys(fieldErrors).length === 0) {
    // Defensive: schema rejected but no field-keyed messages — surface the
    // failure via the sentinel so the envelope still emits the validation
    // response. The sentinel is stripped before the response is built.
    errors[FAILED_SLOT_SENTINEL] = []
    return undefined as T
  }
  mergeFieldErrors(errors, fieldErrors)
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

/**
 * Build the per-method handler map.
 *
 * `defineHandlers` accepts any partial map of `MethodConfig` entries (route
 * authors pin per-method generics via the `method()` helper above). The
 * returned object only carries the methods declared in `config`, plus any
 * `methodNotAllowed` 405-returning entries from `options`.
 */
export const defineHandlers = <C extends ConfigMapInternal>(
  config: C,
  options: DefineHandlersOptions = {},
): { [M in Method]?: (ctx: FrameworkCtx) => Promise<Response> } => {
  const handlers: { [M in Method]?: (ctx: FrameworkCtx) => Promise<Response> } = {}
  const routeId = options.route ?? 'unknown'

  for (const [methodName, methodConfigRaw] of Object.entries(config) as Array<
    [Method, MethodConfig<unknown, unknown, unknown, unknown> | undefined]
  >) {
    if (!methodConfigRaw) continue
    const methodConfig = methodConfigRaw

    handlers[methodName] = (ctx: FrameworkCtx) =>
      methodConfig.reporter.guard(async () => {
        const log = createScopedLogger({ method: methodName, route: routeId }, options.loggerSink)

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
          // Strip the sentinel before exposing the response — its presence
          // only signals "a slot failed but produced no field-level errors".
          delete errors[FAILED_SLOT_SENTINEL]
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

        // Discriminate AIResult vs RouteResult by shape. `RouteResult` carries
        // `data`; `AIResult` carries `ok: true + value` or `ok: false + error +
        // message`. A handler that returns neither is a programmer error — we
        // throw at runtime so the reporter's catch path surfaces it instead of
        // silently dispatching one shape as the other.
        const isRR = isRouteResult(handlerResult)
        const isAI = isAIResult<RouteResult<unknown>>(handlerResult)

        if (isAI && !isRR) {
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

        if (!isRR) {
          // Neither RouteResult nor AIResult. Reject loudly so the reporter
          // catches it and the surface stays consistent — see #11 footgun.
          throw new Error(
            'defineHandlers: handler returned a value that is neither RouteResult ({ data }) nor AIResult ({ ok, value | error+message }).',
          )
        }

        const routeResult = handlerResult as RouteResult<unknown>
        return ok(
          routeResult.data,
          routeResult.invalidate ? { invalidate: routeResult.invalidate } : undefined,
        )
      })
  }

  if (options.methodNotAllowed?.length) {
    const allow = (Object.keys(handlers) as Method[]).join(', ')
    for (const m of options.methodNotAllowed) {
      // Guard against accidental conflict with a declared method — the
      // declared handler always wins.
      if (handlers[m]) continue
      handlers[m] = async () => methodNotAllowedResponse(allow)
    }
  }

  return handlers
}
