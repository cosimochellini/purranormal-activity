import { drizzle } from 'drizzle-orm/libsql/web'
import { serverEnv } from '@/env/server'

type FetchRequestLike = {
  url: string
  method?: string
  headers?: HeadersInit | { entries?: () => IterableIterator<[string, string]> }
  body?: BodyInit | null
  signal?: AbortSignal | null
}

const libsqlFetch: typeof fetch = (input, init) => {
  if (typeof input === 'string' || input instanceof URL || input instanceof Request) {
    return globalThis.fetch(input, init)
  }

  const requestLike = input as FetchRequestLike
  const rawHeaders = requestLike.headers
  const entriesFn =
    rawHeaders && typeof rawHeaders === 'object' && 'entries' in rawHeaders
      ? (rawHeaders as { entries?: () => IterableIterator<[string, string]> }).entries
      : undefined
  const headers = entriesFn
    ? Object.fromEntries(entriesFn.call(rawHeaders))
    : (rawHeaders as HeadersInit | undefined)

  return globalThis.fetch(requestLike.url, {
    method: requestLike.method,
    headers,
    body: requestLike.body ?? undefined,
    signal: requestLike.signal ?? undefined,
  })
}

// Lazy drizzle client: `drizzle({connection})` calls `createClient` which in
// turn destructures `{ url, authToken, ... }` synchronously
// (see `@libsql/core/lib-esm/config.js` -> `expandConfig`). That snapshots
// any getters at module-load, defeating the lazy-env stance. Wrap the
// client in a Proxy so construction only fires on first method access
// (e.g. `db.select(...)`) — by which point the per-request env binding
// exists on Workers.
type DrizzleClient = ReturnType<typeof drizzle>

let _db: DrizzleClient | null = null

const getDb = (): DrizzleClient => {
  if (_db) return _db
  _db = drizzle({
    connection: {
      url: serverEnv.tursoUrl,
      authToken: serverEnv.tursoToken,
      fetch: libsqlFetch,
    },
  })
  return _db
}

export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
}) as DrizzleClient
