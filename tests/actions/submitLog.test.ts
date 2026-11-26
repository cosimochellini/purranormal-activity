import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRAY_LIMITS, CHARACTER_LIMITS } from '@/constants'

vi.mock('@/drizzle', () => ({ db: {} }))
vi.mock('@/services/imageStore/r2.server', () => ({ imageStore: {} }))
vi.mock('@/services/notifier', () => ({ notifier: {} }))
vi.mock('@/services/log', () => ({ getLog: vi.fn(), getLogs: vi.fn() }))
vi.mock('@/services/storyForge', () => ({
  storyForge: {
    questions: vi.fn(),
    logDetails: vi.fn(),
    imagePrompt: vi.fn(),
    telegramMessage: vi.fn(),
    categories: vi.fn(async () => []),
  },
}))
vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    submit: vi.fn(async () => ({ id: 1, enqueued: true })),
  },
}))

import { imagePipeline } from '@/services/imagePipeline'
import { submitLog } from '@/services/logActions.server'
import { storyForge } from '@/services/storyForge'
import { logger } from '@/utils/logger'

type Failure = { success: false; errors: Record<string, string[]> }

describe('submitLog', () => {
  beforeEach(() => {
    vi.mocked(storyForge.logDetails).mockReset()
    vi.mocked(storyForge.categories).mockReset()
    vi.mocked(storyForge.categories).mockResolvedValue([])
    vi.mocked(imagePipeline.submit).mockReset()
    vi.mocked(imagePipeline.submit).mockImplementation(
      async ({ draft }) => ({ id: 1, enqueued: true, draft }) as never,
    )
  })

  describe('Validation guards', () => {
    it.each([
      ['an empty description', { description: '', answers: [] }],
      ['a missing description', { answers: [] }],
      [
        'a description over the cap',
        { description: 'x'.repeat(CHARACTER_LIMITS.DESCRIPTION + 1), answers: [] },
      ],
    ])('returns a description field error for %s', async (_label, input) => {
      const result = (await submitLog(input)) as Failure
      expect(result.success).toBe(false)
      expect(result.errors.description?.length).toBeGreaterThan(0)
      expect(storyForge.logDetails).not.toHaveBeenCalled()
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })

    it('returns an answers field error when there are too many answers', async () => {
      const answers = Array.from({ length: ARRAY_LIMITS.MAX_ANSWERS + 1 }, () => ({
        question: 'Q?',
        answer: 'A.',
      }))

      const result = (await submitLog({ description: 'A real description', answers })) as Failure
      expect(result.success).toBe(false)
      expect(result.errors.answers?.length).toBeGreaterThan(0)
      expect(storyForge.logDetails).not.toHaveBeenCalled()
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })
  })

  describe('Happy path', () => {
    it('hands a filtered categoryIds list to imagePipeline.submit and returns the new id', async () => {
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

      vi.mocked(imagePipeline.submit).mockResolvedValueOnce({ id: 123, enqueued: true })

      const result = await submitLog({
        description: 'A real description that is long enough.',
        answers: [{ question: 'Q?', answer: 'A.' }],
      })

      expect(result).toEqual({ success: true, id: 123 })
      expect(storyForge.logDetails).toHaveBeenCalledWith(
        'A real description that is long enough.',
        [{ question: 'Q?', answer: 'A.' }],
      )
      expect(imagePipeline.submit).toHaveBeenCalledWith({
        draft: {
          title: 'Spectral Cat',
          description: 'A description.',
          imageDescription: 'A floating ghost cat.',
        },
        // Only the categoryId that survives the `allCategoryIds` filter.
        categoryIds: [1],
      })
    })

    it('passes an empty categoryIds list when AI returns zero usable categories', async () => {
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
      vi.mocked(imagePipeline.submit).mockResolvedValueOnce({ id: 5, enqueued: true })

      const result = await submitLog({ description: 'd'.repeat(20), answers: [] })

      expect(result).toEqual({ success: true, id: 5 })
      expect(imagePipeline.submit).toHaveBeenCalledWith({
        draft: { title: 't', description: 'd', imageDescription: 'i' },
        categoryIds: [],
      })
    })

    it('enqueues exactly once on the happy path', async () => {
      // Guards the assertion gap: every other test here pins `success: true`
      // regardless of the pipeline result, so a broken producer binding would
      // otherwise ship green.
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: true,
        value: { title: 't', description: 'd', imageDescription: 'i', categories: [] },
      })
      vi.mocked(storyForge.categories).mockResolvedValueOnce([])
      vi.mocked(imagePipeline.submit).mockResolvedValueOnce({ id: 11, enqueued: true })

      await submitLog({ description: 'd'.repeat(20), answers: [] })

      expect(imagePipeline.submit).toHaveBeenCalledOnce()
    })

    it('still returns success when the row was saved but the enqueue failed (does not poison the response), and logs it', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: true,
        value: { title: 't', description: 'd', imageDescription: 'i', categories: [] },
      })
      vi.mocked(storyForge.categories).mockResolvedValueOnce([])
      vi.mocked(imagePipeline.submit).mockResolvedValueOnce({
        id: 9,
        enqueued: false,
        message: 'Failed to enqueue image generation',
      })
      vi.mocked(logger.error).mockClear()

      const result = await submitLog({ description: 'd'.repeat(20), answers: [] })

      expect(result).toEqual({ success: true, id: 9 })
      // The user's event IS saved and the sweeper will pick it up, but a
      // silent enqueue failure means the queue itself is unreachable.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        'submit: log 9 was saved but not enqueued',
      )
    })
  })

  describe('AIResult error envelope', () => {
    it('returns success:false with a general error and does not submit when storyForge.logDetails returns ok:false (model error)', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: false,
        error: 'model',
        message: 'OpenAI exploded',
      })

      const result = (await submitLog({
        description: 'a description that is long enough',
        answers: [],
      })) as Failure

      expect(result.success).toBe(false)
      expect(result.errors.general?.[0]).toMatch(/AI assistant/i)
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })

    it('returns success:false and does not submit when storyForge.logDetails returns ok:false (parse error)', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: false,
        error: 'parse',
        message: 'Unexpected token in JSON at position 0',
      })

      const result = (await submitLog({
        description: 'a description that is long enough',
        answers: [],
      })) as Failure

      expect(result.success).toBe(false)
      expect(result.errors.general?.[0]).toMatch(/unexpected response/i)
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })

    it('maps validation errors to the "unexpected response" copy', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: false,
        error: 'validation',
        message: 'Expected LogDetails shape',
      })

      const result = (await submitLog({
        description: 'a description that is long enough',
        answers: [],
      })) as Failure

      expect(result.success).toBe(false)
      expect(result.errors.general?.[0]).toMatch(/unexpected response/i)
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })

    it('returns DB-unavailable copy and does not submit when storyForge.categories() throws after a successful logDetails', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: true,
        value: {
          title: 't',
          description: 'd',
          imageDescription: 'i',
          categories: [{ id: 1, name: 'magic' }],
        },
      })
      vi.mocked(storyForge.categories).mockRejectedValueOnce(new Error('libsql connection lost'))

      const result = (await submitLog({
        description: 'a description that is long enough',
        answers: [],
      })) as Failure

      expect(result.success).toBe(false)
      expect(result.errors.general?.[0]).toMatch(/save the event|temporarily unavailable/i)
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })

    it('returns DB-unavailable copy when storyForge.categories() throws a non-Error / non-DB-shaped value (categorical guarantee)', async () => {
      vi.mocked(storyForge.logDetails).mockResolvedValueOnce({
        ok: true,
        value: { title: 't', description: 'd', imageDescription: 'i', categories: [] },
      })
      // Reject with a non-Error value whose stringification (`[object Object]`) lacks DB tokens.
      vi.mocked(storyForge.categories).mockRejectedValueOnce({ code: 'UNKNOWN' })

      const result = (await submitLog({
        description: 'a description that is long enough',
        answers: [],
      })) as Failure

      expect(result.success).toBe(false)
      // Categorical: must be the explicit DB_UNAVAILABLE copy, NOT GENERIC_FALLBACK.
      expect(result.errors.general?.[0]).toMatch(/save the event/i)
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })

    it('still maps unexpected throws (non-AIResult) to a friendly general message', async () => {
      vi.mocked(storyForge.logDetails).mockRejectedValueOnce(new Error('OpenAI exploded'))

      const result = (await submitLog({ description: 'a description', answers: [] })) as Failure

      expect(result.success).toBe(false)
      expect(result.errors.general?.[0]).toMatch(/AI assistant/i)
    })

    it('attributes a thrown "fetch failed" (typical OpenAI undici surface) to the AI assistant, not the connection', async () => {
      vi.mocked(storyForge.logDetails).mockRejectedValueOnce(
        Object.assign(new Error('fetch failed'), { name: 'OpenAIError' }),
      )

      const result = (await submitLog({ description: 'a description', answers: [] })) as Failure

      expect(result.errors.general?.[0]).toMatch(/AI assistant/i)
      expect(imagePipeline.submit).not.toHaveBeenCalled()
    })
  })
})
