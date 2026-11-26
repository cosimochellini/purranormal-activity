import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/drizzle', () => ({ db: {} }))
vi.mock('@/services/imagePipeline', () => ({ imagePipeline: {} }))
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
    invalidateCategories: vi.fn(),
  },
}))

import { refineLog } from '@/services/logActions.server'
import { storyForge } from '@/services/storyForge'

type Failure = { success: false; errors: Record<string, string[]> }

describe('refineLog', () => {
  beforeEach(() => {
    vi.mocked(storyForge.questions).mockReset()
  })

  it('returns the AI questions on success', async () => {
    const questions = [{ question: 'When?', availableAnswers: ['Now'] }]
    vi.mocked(storyForge.questions).mockResolvedValueOnce({ ok: true, value: questions })

    expect(await refineLog({ description: 'A short description' })).toEqual({
      success: true,
      content: questions,
    })
    expect(storyForge.questions).toHaveBeenCalledWith('A short description')
  })

  it('returns success:false with field errors when description is empty', async () => {
    const result = (await refineLog({ description: '' })) as Failure
    expect(result.success).toBe(false)
    expect(result.errors.description?.length).toBeGreaterThan(0)
    expect(storyForge.questions).not.toHaveBeenCalled()
  })

  it('returns a description field error when the description is missing', async () => {
    const result = (await refineLog({})) as Failure
    expect(result.success).toBe(false)
    expect(result.errors.description?.length).toBeGreaterThan(0)
    expect(storyForge.questions).not.toHaveBeenCalled()
  })

  it('rejects descriptions over the 10k character cap', async () => {
    const result = (await refineLog({ description: 'x'.repeat(10001) })) as Failure
    expect(result.success).toBe(false)
    expect(result.errors.description?.length).toBeGreaterThan(0)
    expect(storyForge.questions).not.toHaveBeenCalled()
  })

  it('accepts a description exactly at the 10k character cap', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({ ok: true, value: [] })

    expect(await refineLog({ description: 'x'.repeat(10000) })).toMatchObject({ success: true })
    expect(storyForge.questions).toHaveBeenCalledOnce()
  })

  it('maps AIResult model errors to a friendly message', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({
      ok: false,
      error: 'model',
      message: 'OpenAI rate limit',
    })

    const result = (await refineLog({ description: 'something' })) as Failure
    expect(result.success).toBe(false)
    expect(result.errors.description?.[0]).toMatch(/AI assistant/i)
  })

  it('still maps unexpected throws to a friendly message', async () => {
    vi.mocked(storyForge.questions).mockRejectedValueOnce(new Error('OpenAI rate limit'))

    const result = (await refineLog({ description: 'something' })) as Failure
    expect(result.success).toBe(false)
    expect(result.errors.description?.[0]).toMatch(/AI assistant/i)
  })

  it('maps AIResult parse errors to the "unexpected response" copy', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({
      ok: false,
      error: 'parse',
      message: 'Unexpected token in JSON at position 0',
    })

    const result = (await refineLog({ description: 'something' })) as Failure
    expect(result.success).toBe(false)
    expect(result.errors.description?.[0]).toMatch(/unexpected response/i)
  })

  it('end-to-end wiring: model error with timeout token surfaces the REQUEST_TIMEOUT copy on the description field', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({
      ok: false,
      error: 'model',
      message: 'request timeout after 30s',
    })

    const result = (await refineLog({ description: 'something' })) as Failure
    expect(result.errors.description?.[0]).toMatch(/took too long/i)
  })
})
