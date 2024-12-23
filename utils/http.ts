export function ok<T>(body: T) {
  return new Response(JSON.stringify(body), { status: 200 })
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

export function notFound() {
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
}

export function internalServerError<T>(error?: T) {
  return new Response(JSON.stringify({ error }), { status: 500 })
}
