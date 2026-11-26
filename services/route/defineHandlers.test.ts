import { describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import type { FriendlyReporter } from '@/services/friendly'
import { defineHandlers, type RouteResult } from '@/services/route/defineHandlers'

// A no-op reporter that mirrors `createFriendly`'s contract without the
// `services/friendly.ts` matcher / classification surface. Tests that want to inspect
// reporter behaviour drive the spies directly.
const makeStubReporter = (): FriendlyReporter<Response> & {
  guardSpy: ReturnType<typeof vi.fn>
  fromAiSpy: ReturnType<typeof vi.fn>
  fromThrownResponse: Response
} => {
  const fromThrownResponse = new Response(
    JSON.stringify({ success: false, errors: { general: ['friendly:thrown'] } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

  const fromAiResponse = new Response(
    JSON.stringify({ success: false, errors: { general: ['friendly:ai'] } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

  const guardSpy = vi.fn(async (run: () => Promise<Response>) => {
    try {
      return await run()
    } catch {
      return fromThrownResponse
    }
  })

  const fromAiSpy = vi.fn(<T>(result: { ok: true; value: T } | { ok: false }) => {
    if ((result as { ok: true; value: T }).ok) {
      return { ok: true as const, value: (result as { ok: true; value: T }).value }
    }
    return { ok: false as const, response: fromAiResponse }
  })

  return {
    guard: guardSpy as unknown as FriendlyReporter<Response>['guard'],
    fromAi: fromAiSpy as unknown as FriendlyReporter<Response>['fromAi'],
    guardSpy,
    fromAiSpy,
    fromThrownResponse,
  }
}

const jsonRequest = (url: string, body?: unknown) =>
  new Request(url, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  })

describe('defineHandlers — envelope', () => {
  describe('no-schema handler', () => {
    it('runs and wraps a RouteResult into a JSON 200 Response', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        GET: {
          reporter,
          handler: async () => ({ data: { success: true, who: 'kitten' } as const }),
        },
      })

      const res = await handlers.GET?.({
        request: new Request('http://t/api/x', { method: 'GET' }),
        params: {},
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json')
      expect(await res.json()).toEqual({ success: true, who: 'kitten' })
      expect(res.headers.get('X-Invalidate')).toBeNull()
    })
  })

  describe('validation', () => {
    it('produces a flat ValidationFailure when the body schema rejects', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          body: z.object({ description: z.string().min(3, 'too short') }),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', { description: '' }),
        params: {},
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.description).toEqual(['too short'])
    })

    it('merges body + query slot failures into one flat errors object (no slot prefixes)', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          body: z.object({ description: z.string().min(3, 'desc-too-short') }),
          query: z.object({ page: z.string().regex(/^\d+$/, 'page-not-numeric') }),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x?page=nope', { description: '' }),
        params: {},
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.description).toEqual(['desc-too-short'])
      expect(body.errors.page).toEqual(['page-not-numeric'])
      // No slot prefixes — keys are flat field names.
      expect(Object.keys(body.errors).sort()).toEqual(['description', 'page'])
    })

    it('does not invoke handler when validation fails', async () => {
      const reporter = makeStubReporter()
      const handler = vi.fn(async () => ({ data: { success: true } as const }))

      const handlers = defineHandlers({
        POST: {
          body: z.object({ description: z.string().min(3) }),
          reporter,
          handler,
        },
      })

      await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('AIResult unwrap', () => {
    it('unwraps an AIResult.ok return into a success Response with invalidate honoured', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          reporter,
          handler: async () =>
            ({
              ok: true,
              value: {
                data: { success: true, id: 9 },
                invalidate: ['logs' as const, 'log:9' as const],
              } satisfies RouteResult<{ success: true; id: number }>,
            }) as const,
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-Invalidate')).toBe('logs,log:9')
      expect(await res.json()).toEqual({ success: true, id: 9 })
    })

    it('routes an AIResult.err through reporter.fromAi and returns its Response verbatim (no double-wrap)', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          reporter,
          handler: async () =>
            ({ ok: false, error: 'model' as const, message: 'OpenAI down' }) as const,
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      expect(reporter.fromAiSpy).toHaveBeenCalledOnce()
      // Body is the reporter's stub response — not double-wrapped.
      expect(await res.json()).toEqual({ success: false, errors: { general: ['friendly:ai'] } })
    })
  })

  describe('throws', () => {
    it('routes thrown handlers through reporter.guard exactly once and returns the reporter response', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          reporter,
          handler: async () => {
            throw new Error('boom')
          },
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      expect(reporter.guardSpy).toHaveBeenCalledOnce()
      expect(await res.json()).toEqual({ success: false, errors: { general: ['friendly:thrown'] } })
    })
  })

  describe('scoped logger', () => {
    it('binds ctx.log to a scoped logger that emits with { method, route } metadata', async () => {
      const reporter = makeStubReporter()
      const sink = vi.fn()

      const handlers = defineHandlers(
        {
          POST: {
            reporter,
            handler: async (_input, { log }) => {
              log.error('storyForge.questions failed', { logId: 7 })
              return { data: { success: true } as const }
            },
          },
        },
        { loggerSink: sink, route: '/api/x' },
      )

      await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      expect(sink).toHaveBeenCalledWith('error', { method: 'POST', route: '/api/x' }, [
        'storyForge.questions failed',
        { logId: 7 },
      ])
    })
  })

  describe('handlers shape', () => {
    it('produces only the methods declared in config (no widening)', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      expect(handlers.POST).toBeTypeOf('function')
      expect(handlers.GET).toBeUndefined()
      expect(handlers.PUT).toBeUndefined()
      expect(handlers.DELETE).toBeUndefined()
    })
  })

  describe('nested-array shape (pre-refactor parity for `submit`)', () => {
    it('emits top-level `[]` for a nested-array field whose issues are buried in elements', async () => {
      const reporter = makeStubReporter()

      // The `answers` field is an array of objects; the failure lives inside
      // an element (`answers[0].question`), not on the array itself.
      // `treeifyError + properties` returns `properties.answers.errors === []`
      // because the top-level key has no errors of its own — the pre-refactor
      // reshape preserved that empty-array signal.
      const handlers = defineHandlers({
        POST: {
          body: z.object({
            description: z.string(),
            answers: z.array(z.object({ question: z.string().min(1, 'q-too-short') })),
          }),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {
          description: 'ok',
          answers: [{ question: '' }],
        }),
        params: {},
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      // The nested-array shape: `answers` key is present with an empty array,
      // not absent, not hoisted to a string list.
      expect(body.errors.answers).toEqual([])
    })
  })

  describe('isAIResult footgun (handler return-type discrimination)', () => {
    it('throws when handler returns a value matching neither RouteResult nor AIResult', async () => {
      const reporter = makeStubReporter()

      // Handler accidentally returns `{ ok: true, value: ... }` shaped like
      // an AIResult success but with no `data` field — the envelope used to
      // silently dispatch this as an AI success and call `inner.data` on
      // `undefined`. Now we throw at runtime; the reporter catches it.
      const handlers = defineHandlers({
        POST: {
          reporter,
          handler: async () =>
            // Intentionally malformed: missing `data` AND missing AI-error
            // co-fields (no `error`/`message`). Cast via `unknown` to bypass
            // the compile-time discriminator.
            ({ totally: 'wrong' }) as unknown as RouteResult<{ success: true }>,
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      // Routed through the reporter's stub `fromThrownResponse`.
      expect(await res.json()).toEqual({ success: false, errors: { general: ['friendly:thrown'] } })
    })

    it('does NOT misclassify a legitimate AIResult `!ok` as a programmer error', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          reporter,
          handler: async () =>
            ({ ok: false, error: 'parse' as const, message: 'broken json' }) as const,
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', {}),
        params: {},
      })
      // Routed through `reporter.fromAi`, not the throw path.
      expect(reporter.fromAiSpy).toHaveBeenCalledOnce()
      expect(await res.json()).toEqual({ success: false, errors: { general: ['friendly:ai'] } })
    })
  })

  describe('cross-slot field-name collision', () => {
    it('concatenates and dedupes error messages when body and params both fail under the same key', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          // Both schemas have an `id` field — when both reject the same
          // request, the envelope must surface both messages under one key,
          // not drop one or the other.
          body: z.object({ id: z.string().min(5, 'body-id-too-short') }),
          params: z.object({ id: z.string().regex(/^\d+$/, 'params-id-not-numeric') }),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x/abc', { id: 'ab' }),
        params: { id: 'abc' },
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      // Both messages present, deduped via `Set`. Order: body first (insertion).
      expect(body.errors.id).toEqual(['body-id-too-short', 'params-id-not-numeric'])
    })

    it('dedupes identical messages across slots', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          body: z.object({ id: z.string().min(5, 'same-msg') }),
          params: z.object({ id: z.string().min(5, 'same-msg') }),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', { id: 'a' }),
        params: { id: 'a' },
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.errors.id).toEqual(['same-msg'])
    })
  })

  describe('defensive treeifyError handling', () => {
    it('falls back to `errors: {}` when the zod schema returns a tree without `.properties`', async () => {
      const reporter = makeStubReporter()

      // A primitive top-level schema (no `properties` in its treeified tree)
      // exercises the documented defensive branch: the envelope cannot map a
      // non-object failure into a `{ field: [...] }` shape, so it emits `{}`
      // rather than throwing or surfacing root-level issues.
      const handlers = defineHandlers({
        POST: {
          body: z.string().min(5, 'too-short'),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x', 'ab'),
        params: {},
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      // Documented fallback: empty `errors` object, not a throw.
      expect(body.errors).toEqual({})
    })
  })

  describe('methodNotAllowed option', () => {
    it('emits a 405 with `Allow:` header for listed methods', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers(
        {
          POST: {
            reporter,
            handler: async () => ({ data: { success: true } as const }),
          },
        },
        { methodNotAllowed: ['GET'] },
      )

      expect(handlers.GET).toBeTypeOf('function')
      const res = await handlers.GET?.({
        request: new Request('http://t/api/x', { method: 'GET' }),
        params: {},
      })
      expect(res.status).toBe(405)
      expect(res.headers.get('Allow')).toBe('POST')
    })

    it('does not overwrite a method declared in `config`', async () => {
      const reporter = makeStubReporter()
      const handler = vi.fn(async () => ({ data: { success: true } as const }))

      const handlers = defineHandlers(
        {
          GET: { reporter, handler },
          POST: { reporter, handler: async () => ({ data: { success: true } as const }) },
        },
        { methodNotAllowed: ['GET'] },
      )

      const res = await handlers.GET?.({
        request: new Request('http://t/api/x', { method: 'GET' }),
        params: {},
      })
      expect(res.status).toBe(200)
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('params slot', () => {
    it('forwards values from the framework params into input.params', async () => {
      const reporter = makeStubReporter()
      const handler = vi.fn(async (input: { params: { id: string } }) => ({
        data: { success: true, id: Number(input.params.id) } as const,
      }))

      const handlers = defineHandlers({
        POST: {
          params: z.object({ id: z.string().regex(/^\d+$/) }),
          reporter,
          handler: handler as never,
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x/7', {}),
        params: { id: '7' },
      })
      expect(await res.json()).toEqual({ success: true, id: 7 })
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: '7' } }),
        expect.anything(),
      )
    })

    it('flattens param validation failures into the same errors object as body slot failures', async () => {
      const reporter = makeStubReporter()

      const handlers = defineHandlers({
        POST: {
          params: z.object({ id: z.string().regex(/^\d+$/, 'invalid-id') }),
          body: z.object({ description: z.string().min(3, 'too-short') }),
          reporter,
          handler: async () => ({ data: { success: true } as const }),
        },
      })

      const res = await handlers.POST?.({
        request: jsonRequest('http://t/api/x/abc', { description: '' }),
        params: { id: 'abc' },
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.errors.description).toEqual(['too-short'])
      expect(body.errors.id).toEqual(['invalid-id'])
    })
  })
})
