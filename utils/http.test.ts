import { describe, expect, it } from 'vitest'
import {
  badRequest,
  forbidden,
  internalServerError,
  methodNotAllowed,
  notFound,
  ok,
  unauthorized,
} from './http'

const parseBody = async (res: Response) => JSON.parse(await res.text())

describe('http response builders', () => {
  describe('ok', () => {
    it('returns 200 with the body serialized as JSON', async () => {
      const res = ok({ hello: 'world' })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json')
      expect(await parseBody(res)).toEqual({ hello: 'world' })
    })

    it('serializes primitive bodies', async () => {
      const res = ok('plain')
      expect(res.status).toBe(200)
      expect(await parseBody(res)).toBe('plain')
    })

    it('does not emit X-Invalidate when init is omitted', () => {
      const res = ok({ hello: 'world' })
      expect(res.headers.get('X-Invalidate')).toBeNull()
    })

    it('does not emit X-Invalidate when invalidate is an empty array', () => {
      const res = ok({ ok: true }, { invalidate: [] })
      expect(res.headers.get('X-Invalidate')).toBeNull()
    })

    it('emits a single X-Invalidate tag', () => {
      const res = ok({ ok: true }, { invalidate: ['logs'] })
      expect(res.headers.get('X-Invalidate')).toBe('logs')
    })

    it('joins multiple X-Invalidate tags with a single comma (no spaces)', () => {
      const res = ok({ ok: true }, { invalidate: ['logs', 'log:7'] })
      expect(res.headers.get('X-Invalidate')).toBe('logs,log:7')
    })
  })

  describe('badRequest', () => {
    it('returns 400 with the wrapped error', async () => {
      const res = badRequest('boom')
      expect(res.status).toBe(400)
      expect(await parseBody(res)).toEqual({ error: 'boom' })
    })

    it('returns 400 with undefined error when none is provided', async () => {
      const res = badRequest()
      expect(res.status).toBe(400)
      expect(await parseBody(res)).toEqual({})
    })
  })

  describe('unauthorized', () => {
    it('returns 401 with a fixed Unauthorized error', async () => {
      const res = unauthorized()
      expect(res.status).toBe(401)
      expect(await parseBody(res)).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('forbidden', () => {
    it('returns 403 with a fixed Forbidden error', async () => {
      const res = forbidden()
      expect(res.status).toBe(403)
      expect(await parseBody(res)).toEqual({ error: 'Forbidden' })
    })
  })

  describe('methodNotAllowed', () => {
    it('returns 405 with no Allow header by default', async () => {
      const res = methodNotAllowed()
      expect(res.status).toBe(405)
      expect(res.headers.get('Allow')).toBeNull()
      expect(await parseBody(res)).toEqual({ error: 'Method Not Allowed' })
    })

    it('returns 405 with the provided Allow header', async () => {
      const res = methodNotAllowed('GET, POST')
      expect(res.status).toBe(405)
      expect(res.headers.get('Allow')).toBe('GET, POST')
      expect(await parseBody(res)).toEqual({ error: 'Method Not Allowed' })
    })
  })

  describe('notFound', () => {
    it('returns 404 with a fixed Not Found error', async () => {
      const res = notFound()
      expect(res.status).toBe(404)
      expect(await parseBody(res)).toEqual({ error: 'Not Found' })
    })
  })

  describe('internalServerError', () => {
    it('returns 500 with a wrapped error', async () => {
      const res = internalServerError('crash')
      expect(res.status).toBe(500)
      expect(await parseBody(res)).toEqual({ error: 'crash' })
    })

    it('returns 500 with no error body when omitted', async () => {
      const res = internalServerError()
      expect(res.status).toBe(500)
      expect(await parseBody(res)).toEqual({})
    })
  })
})
