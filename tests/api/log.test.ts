import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

// Pull the same singleton fake DB out of the mocked module.
const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

import { Route } from '@/start/routes/api/log'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>

const callPost = (body: unknown) =>
  POST({
    request: new Request('http://test/api/log', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  })

describe('POST /api/log', () => {
  beforeEach(() => {
    fakeDb.__reset()
  })

  it('returns success:false with field errors when the body is invalid', async () => {
    const res = await callPost({ title: '', description: '', categories: [] })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.title?.length).toBeGreaterThan(0)
    expect(body.errors.description?.length).toBeGreaterThan(0)
    expect(body.errors.categories?.length).toBeGreaterThan(0)
    // Validation should short-circuit before hitting the DB.
    expect(fakeDb.insert).not.toHaveBeenCalled()
  })

  it('inserts the log and its category links on a valid body', async () => {
    fakeDb.__queue('returning', [{ id: 42 }])
    fakeDb.__queue('returning', undefined) // for the logCategory insert chain

    const res = await callPost({
      title: 'A spooky cat',
      description: 'It floated for ten seconds',
      categories: [1, 2],
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })

    // First insert into log (with title/description/categories[]) — drizzle pattern.
    expect(fakeDb.insert).toHaveBeenCalledTimes(2)
    expect(fakeDb.values).toHaveBeenCalledTimes(2)
    // Second insert is the category-junction rows referencing newLog.id (42).
    expect(fakeDb.values).toHaveBeenLastCalledWith([
      { logId: 42, categoryId: 1 },
      { logId: 42, categoryId: 2 },
    ])
  })

  it('returns success:false with a general error when the DB insert throws', async () => {
    vi.mocked(fakeDb.returning).mockRejectedValueOnce(new Error('boom'))

    const res = await callPost({
      title: 'A title',
      description: 'A description',
      categories: [1],
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.general?.[0]).toMatch(/Failed to create log/i)
  })
})
