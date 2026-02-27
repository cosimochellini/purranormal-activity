import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from '@/env/db'
import { drizzle } from 'drizzle-orm/libsql/web'

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
  const headers =
    requestLike.headers && typeof requestLike.headers === 'object' && 'entries' in requestLike.headers
      ? Object.fromEntries(requestLike.headers.entries?.() ?? [])
      : (requestLike.headers as HeadersInit | undefined)

  return globalThis.fetch(requestLike.url, {
    method: requestLike.method,
    headers,
    body: requestLike.body ?? undefined,
    signal: requestLike.signal ?? undefined,
  })
}

export const db = drizzle({
  connection: {
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
    fetch: libsqlFetch,
  },
})
