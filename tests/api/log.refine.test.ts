import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/ai', () => ({
  createQuestions: vi.fn(),
}))

import { createQuestions } from '@/services/ai'
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
    vi.mocked(createQuestions).mockReset()
  })

  it('returns the AI questions on success', async () => {
    const questions = [{ question: 'When?', availableAnswers: ['Now'] }]
    vi.mocked(createQuestions).mockResolvedValueOnce(questions)

    const res = await callPost({ description: 'A short description' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, content: questions })
    expect(createQuestions).toHaveBeenCalledWith('A short description')
  })

  it('returns success:false with field errors when description is empty', async () => {
    const res = await callPost({ description: '' })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.length).toBeGreaterThan(0)
    expect(createQuestions).not.toHaveBeenCalled()
  })

  it('rejects descriptions over the 10k character cap', async () => {
    const tooLong = 'x'.repeat(10001)
    const res = await callPost({ description: tooLong })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.length).toBeGreaterThan(0)
    expect(createQuestions).not.toHaveBeenCalled()
  })

  it('accepts a description exactly at the 10k character cap', async () => {
    vi.mocked(createQuestions).mockResolvedValueOnce([])

    const res = await callPost({ description: 'x'.repeat(10000) })
    expect((await res.json()) as { success: boolean }).toMatchObject({ success: true })
    expect(createQuestions).toHaveBeenCalledOnce()
  })

  it('maps AI failures to a friendly message', async () => {
    vi.mocked(createQuestions).mockRejectedValueOnce(new Error('OpenAI rate limit'))

    const res = await callPost({ description: 'something' })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.description?.[0]).toMatch(/AI assistant/i)
  })
})
