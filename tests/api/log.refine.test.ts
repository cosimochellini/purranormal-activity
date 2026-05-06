import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { storyForge } from '@/services/storyForge'
import { Route } from '@/start/routes/api/log/refine'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>

const callPost = (body: unknown) =>
  POST({
    request: new Request('http://test/api/log/refine', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  })

describe('POST /api/log/refine', () => {
  beforeEach(() => {
    vi.mocked(storyForge.questions).mockReset()
  })

  it('returns the AI questions on success', async () => {
    const questions = [{ question: 'When?', availableAnswers: ['Now'] }]
    vi.mocked(storyForge.questions).mockResolvedValueOnce({ ok: true, value: questions })

    const res = await callPost({ description: 'A short description' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, content: questions })
    expect(storyForge.questions).toHaveBeenCalledWith('A short description')
  })

  it('returns success:false with field errors when description is empty', async () => {
    const res = await callPost({ description: '' })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.length).toBeGreaterThan(0)
    expect(storyForge.questions).not.toHaveBeenCalled()
  })

  it('rejects descriptions over the 10k character cap', async () => {
    const tooLong = 'x'.repeat(10001)
    const res = await callPost({ description: tooLong })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.length).toBeGreaterThan(0)
    expect(storyForge.questions).not.toHaveBeenCalled()
  })

  it('accepts a description exactly at the 10k character cap', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({ ok: true, value: [] })

    const res = await callPost({ description: 'x'.repeat(10000) })
    expect((await res.json()) as { success: boolean }).toMatchObject({ success: true })
    expect(storyForge.questions).toHaveBeenCalledOnce()
  })

  it('maps AIResult model errors to a friendly message', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({
      ok: false,
      error: 'model',
      message: 'OpenAI rate limit',
    })

    const res = await callPost({ description: 'something' })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.[0]).toMatch(/AI assistant/i)
  })

  it('still maps unexpected throws to a friendly message', async () => {
    vi.mocked(storyForge.questions).mockRejectedValueOnce(new Error('OpenAI rate limit'))

    const res = await callPost({ description: 'something' })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.[0]).toMatch(/AI assistant/i)
  })

  it('maps AIResult parse errors to the "unexpected response" copy', async () => {
    vi.mocked(storyForge.questions).mockResolvedValueOnce({
      ok: false,
      error: 'parse',
      message: 'Unexpected token in JSON at position 0',
    })

    const res = await callPost({ description: 'something' })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.[0]).toMatch(/unexpected response/i)
  })
})
