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

vi.mock('@/services/storyForge', () => ({
  storyForge: {
    questions: vi.fn(),
    logDetails: vi.fn(),
    imagePrompt: vi.fn(),
    telegramMessage: vi.fn(),
    categories: vi.fn(async () => []),
    invalidateCategories: vi.fn(),
  },
}))

vi.mock('@/services/content', () => ({
  regenerateContents: vi.fn(async () => ({ imageTriggered: true })),
}))

import { regenerateContents } from '@/services/content'
import { storyForge } from '@/services/storyForge'
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
    vi.mocked(storyForge.logDetails).mockReset()
    vi.mocked(storyForge.categories).mockReset()
    vi.mocked(storyForge.categories).mockResolvedValue([])
    vi.mocked(regenerateContents).mockClear()
  })

  describe('Bug #12 — defensive treeifyError handling', () => {
    it('returns 200 with success:false when validation fails (does not crash)', async () => {
      const res = await callPost({})

      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.general).toBeUndefined()
      expect(typeof body.errors).toBe('object')
      expect(storyForge.logDetails).not.toHaveBeenCalled()
      expect(fakeDb.insert).not.toHaveBeenCalled()
    })

    it('does not crash when treeifyError returns a tree without a properties key', async () => {
      treeifyOverride.fn = () => ({ errors: null, properties: null })

      try {
        const res = await callPost({ description: '', answers: [], secret: 'wrong' })
        expect(res.status).toBe(200)
        const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
        expect(body.success).toBe(false)
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
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: true,
        value: {
          title: 'Spectral Cat',
          description: 'A description.',
          imageDescription: 'A floating ghost cat.',
          categories: [
            { id: 1, name: 'Levitation' },
            { id: 99, name: 'Bogus' },
          ],
        },
      })

      vi.mocked(storyForge.categories).mockResolvedValueOnce([
        { id: 1, name: 'Levitation' },
        { id: 2, name: 'Other' },
      ])
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

      expect(fakeDb.values).toHaveBeenLastCalledWith([{ logId: 123, categoryId: 1 }])
      expect(regenerateContents).toHaveBeenCalledWith({ triggerLogId: 123 })
    })

    it('skips the category-junction insert when AI returns zero usable categories', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: true,
        value: {
          title: 't',
          description: 'd',
          imageDescription: 'i',
          categories: [{ id: 99, name: 'Bogus' }],
        },
      })

      vi.mocked(storyForge.categories).mockResolvedValueOnce([{ id: 1, name: 'Real' }])
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
      expect(fakeDb.insert).toHaveBeenCalledOnce()
    })
  })

  describe('AIResult error envelope (bug #7 fix)', () => {
    it('returns success:false with general error and DOES NOT insert when storyForge.logDetails returns ok:false (model error)', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: false,
        error: 'model',
        message: 'OpenAI exploded',
      })

      const res = await callPost({
        description: 'a description that is long enough',
        answers: [],
        secret: 'test-secret',
      })

      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.general?.[0]).toMatch(/AI assistant/i)
      expect(res.headers.get('X-Invalidate')).toBeNull()
      // The bug fix: NO log row is inserted when AI fails.
      expect(fakeDb.insert).not.toHaveBeenCalled()
    })

    it('returns success:false with general error and DOES NOT insert when storyForge.logDetails returns ok:false (parse error)', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: false,
        error: 'parse',
        message: 'Unexpected token in JSON at position 0',
      })

      const res = await callPost({
        description: 'a description that is long enough',
        answers: [],
        secret: 'test-secret',
      })

      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.general?.length).toBeGreaterThan(0)
      expect(res.headers.get('X-Invalidate')).toBeNull()
      expect(fakeDb.insert).not.toHaveBeenCalled()
    })

    it('still maps unexpected throws (non-AIResult) to a friendly general message', async () => {
      vi.mocked(storyForge.logDetails).mockRejectedValueOnce(new Error('OpenAI exploded'))

      const res = await callPost({
        description: 'a description',
        answers: [],
        secret: 'test-secret',
      })

      const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
      expect(body.success).toBe(false)
      expect(body.errors.general?.[0]).toMatch(/AI assistant/i)
      expect(res.headers.get('X-Invalidate')).toBeNull()
    })
  })
})
