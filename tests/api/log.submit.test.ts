import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../helpers'

// Lets a single test override `z.treeifyError` to exercise Bug #12.
const treeifyOverride: { fn: ((error: unknown) => unknown) | null } = { fn: null }

vi.mock('zod', async () => {
  const actual = (await vi.importActual('zod')) as typeof import('zod')
  return {
    ...actual,
    z: new Proxy(actual.z, {
      get(target, prop, receiver) {
        if (prop === 'treeifyError' && treeifyOverride.fn) return treeifyOverride.fn
        return Reflect.get(target, prop, receiver)
      },
    }),
  }
})

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

vi.mock('@/env/secret', () => ({
  SECRET: 'test-secret',
}))

vi.mock('@/services/ai', () => ({
  generateLogDetails: vi.fn(),
}))

vi.mock('@/services/content', () => ({
  regenerateContents: vi.fn(async () => ({ imageTriggered: true })),
}))

import { generateLogDetails } from '@/services/ai'
import { regenerateContents } from '@/services/content'
import { Route } from '@/start/routes/api/log/submit'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>

const callPost = (body: unknown) =>
  POST({
    request: new Request('http://test/api/log/submit', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  })

describe('POST /api/log/submit', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(generateLogDetails).mockReset()
    vi.mocked(regenerateContents).mockClear()
  })

  describe('Bug #12 — defensive treeifyError handling', () => {
    it('returns 200 with success:false when validation fails (does not crash)', async () => {
      // Empty body: every field is missing → guaranteed validation failure.
      const res = await callPost({})

      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      // It must NOT have fallen into the catch block (which would set
      // `general` instead of per-field errors).
      expect(body.errors.general).toBeUndefined()
      expect(typeof body.errors).toBe('object')
      // Should not have called the AI / DB at all.
      expect(generateLogDetails).not.toHaveBeenCalled()
      expect(fakeDb.insert).not.toHaveBeenCalled()
    })

    it('does not crash when treeifyError returns a tree without a properties key', async () => {
      // Force `z.treeifyError` (proxied at the top of this file) to return a
      // tree whose `.properties` and `.errors` are both null. This is the
      // regression case for Bug #12 — previously the handler accessed both
      // directly without guarding for missing tree shape.
      treeifyOverride.fn = () => ({ errors: null, properties: null })

      try {
        const res = await callPost({ description: '', answers: [], secret: 'wrong' })
        expect(res.status).toBe(200)
        const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
        expect(body.success).toBe(false)
        // No fields → empty errors object, but it MUST be an object (not a
        // 500-style crash, and not the catch-all `general` message).
        expect(body.errors).toEqual({})
      } finally {
        treeifyOverride.fn = null
      }
    })

    it('returns the secret field error when the secret does not match', async () => {
      const res = await callPost({
        description: 'A real description',
        answers: [],
        secret: 'definitely-wrong',
      })
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.secret?.length).toBeGreaterThan(0)
    })
  })

  describe('Happy path', () => {
    it('inserts the AI-enriched log and triggers regeneration', async () => {
      vi.mocked(generateLogDetails).mockResolvedValueOnce({
        title: 'Spectral Cat',
        description: 'A description.',
        imageDescription: 'A floating ghost cat.',
        // categoryId 99 isn't in the DB → should be filtered out.
        categories: [
          { id: 1, name: 'Levitation' },
          { id: 99, name: 'Bogus' },
        ],
      } as never)

      // 1) `db.select({id: category.id}).from(category)` resolves to known ids.
      vi.mocked(fakeDb.from).mockReturnValueOnce([{ id: 1 }, { id: 2 }] as never)
      // 2) `db.insert(log).values(...).returning(...)` returns the new row id.
      fakeDb.__queue('returning', [{ id: 123 }])

      const res = await callPost({
        description: 'A real description that is long enough.',
        answers: [{ question: 'Q?', answer: 'A.' }],
        secret: 'test-secret',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Invalidate')).toBe('logs,log:123')
      expect(await res.json()).toEqual({
        success: true,
        id: 123,
        missingCategories: [],
      })

      // categoryId 1 maps to allCategories=[1,2] → kept; 99 → filtered out.
      expect(fakeDb.values).toHaveBeenLastCalledWith([{ logId: 123, categoryId: 1 }])
      expect(regenerateContents).toHaveBeenCalledWith({ triggerLogId: 123 })
    })

    it('skips the category-junction insert when AI returns zero usable categories', async () => {
      vi.mocked(generateLogDetails).mockResolvedValueOnce({
        title: 't',
        description: 'd',
        imageDescription: 'i',
        categories: [{ id: 99, name: 'Bogus' }],
      } as never)

      vi.mocked(fakeDb.from).mockReturnValueOnce([{ id: 1 }] as never)
      fakeDb.__queue('returning', [{ id: 5 }])

      const res = await callPost({
        description: 'd'.repeat(20),
        answers: [],
        secret: 'test-secret',
      })

      const body = (await res.json()) as { success: true; id: number }
      expect(body.success).toBe(true)
      expect(body.id).toBe(5)
      expect(res.headers.get('X-Invalidate')).toBe('logs,log:5')
      // Only the log insert should have run; the category-junction insert is
      // skipped when nothing survives the filter.
      expect(fakeDb.insert).toHaveBeenCalledOnce()
    })

    it('maps AI errors to a friendly general message', async () => {
      vi.mocked(generateLogDetails).mockRejectedValueOnce(new Error('OpenAI exploded'))

      const res = await callPost({
        description: 'a description',
        answers: [],
        secret: 'test-secret',
      })

      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.general?.[0]).toMatch(/AI assistant/i)
      // Failure path must NOT carry an invalidation tag.
      expect(res.headers.get('X-Invalidate')).toBeNull()
    })
  })
})
