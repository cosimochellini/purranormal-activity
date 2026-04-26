import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

import { Route } from '@/start/routes/api/log/$id/categories'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
  params: { id: string }
}) => Promise<Response>

const callPost = (id: string, body: unknown) =>
  POST({
    request: new Request(`http://test/api/log/${id}/categories`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    params: { id },
  })

describe('POST /api/log/$id/categories', () => {
  beforeEach(() => {
    fakeDb.__reset()
  })

  it('rejects a non-numeric id with a categories field error', async () => {
    const res = await callPost('abc', { categories: [1] })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.categories).toEqual(['Invalid log id'])
    expect(fakeDb.insert).not.toHaveBeenCalled()
  })

  it('returns flattened field errors when categories is empty', async () => {
    const res = await callPost('7', { categories: [] })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.categories?.length).toBeGreaterThan(0)
    expect(fakeDb.insert).not.toHaveBeenCalled()
  })

  it('inserts the category-junction rows on success', async () => {
    const res = await callPost('7', { categories: [11, 22] })
    expect(await res.json()).toEqual({ success: true })
    expect(res.headers.get('X-Invalidate')).toBe('logs,log:7')

    expect(fakeDb.insert).toHaveBeenCalledOnce()
    expect(fakeDb.values).toHaveBeenCalledWith([
      { logId: 7, categoryId: 11 },
      { logId: 7, categoryId: 22 },
    ])
  })

  it('returns the catch-all error response when the DB throws', async () => {
    vi.mocked(fakeDb.values).mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await callPost('7', { categories: [11] })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.categories).toEqual(['Failed to add categories to log'])
  })
})
