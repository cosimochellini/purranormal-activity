const JSON_HEADERS = {
  'Content-Type': 'application/json',
} as const

export const StatusCode = {
  Ok: 200,
  NoContent: 204,
  ResetContent: 205,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  Conflict: 409,
  TooManyRequests: 429,
  InternalServerError: 500,
  BadGateway: 502,
} as const

type ResponseInitWithStatus = Omit<ResponseInit, 'status'> & {
  status?: number
}

export function json<T>(body: T, init: ResponseInitWithStatus = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_HEADERS['Content-Type'])
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
    status: init.status ?? StatusCode.Ok,
  })
}

export function ok<T>(body: T, init: ResponseInitWithStatus = {}) {
  return json(body, { ...init, status: init.status ?? StatusCode.Ok })
}

export function badRequest<T>(error?: T) {
  return json({ error }, { status: StatusCode.BadRequest })
}

export function unauthorized(error = 'Unauthorized') {
  return json({ error }, { status: StatusCode.Unauthorized })
}

export function forbidden(error = 'Forbidden') {
  return json({ error }, { status: StatusCode.Forbidden })
}

export function tooManyRequests(error = 'Too Many Requests') {
  return json({ error }, { status: StatusCode.TooManyRequests })
}

export function methodNotAllowed(allow?: string) {
  return json(
    { error: 'Method Not Allowed' },
    {
      status: StatusCode.MethodNotAllowed,
      headers: allow ? { Allow: allow } : undefined,
    },
  )
}

export function notFound(error = 'Not Found') {
  return json({ error }, { status: StatusCode.NotFound })
}

export function internalServerError<T>(error?: T) {
  return json({ error }, { status: StatusCode.InternalServerError })
}
