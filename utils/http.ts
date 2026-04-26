import type { InvalidationTag } from './invalidation'

interface OkInit {
  invalidate?: readonly InvalidationTag[]
}

export function ok<T>(body: T, init?: OkInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (init?.invalidate?.length) {
    headers['X-Invalidate'] = init.invalidate.join(',')
  }

  return new Response(JSON.stringify(body), { status: 200, headers })
}

export function badRequest<T>(error?: T) {
  return new Response(JSON.stringify({ error }), { status: 400 })
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
  })
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
}

export function methodNotAllowed(allow?: string) {
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: allow ? { Allow: allow } : undefined,
  })
}

export function notFound() {
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
}

export function internalServerError<T>(error?: T) {
  return new Response(JSON.stringify({ error }), { status: 500 })
}
