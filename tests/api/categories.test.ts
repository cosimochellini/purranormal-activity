import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

import { Route } from '@/start/routes/api/categories'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const GET = Route.options.server?.handlers?.GET as () => Promise<Response>
const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>

const callPost = (body: unknown) =>
  POST({
    request: new Request('http://test/api/categories', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  })

describe('GET /api/categories', () => {
  beforeEach(() => {
    fakeDb.__reset()
  })

  it('returns the rows fetched from the DB', async () => {
    const rows = [{ id: 1, name: 'Levitation', icon: 'questionMark' }]
    vi.mocked(fakeDb.from).mockReturnValueOnce(rows as never)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
  })

  it('returns an empty array when the DB throws', async () => {
    vi.mocked(fakeDb.from).mockImplementationOnce(() => {
      throw new Error('db down')
    })
    const res = await GET()
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/categories', () => {
  beforeEach(() => {
    fakeDb.__reset()
  })

  it('returns success:false with field errors when the body is invalid', async () => {
    const res = await callPost({ categories: [] })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.categories?.length).toBeGreaterThan(0)
    expect(fakeDb.insert).not.toHaveBeenCalled()
  })

  it('inserts each new category with the default icon', async () => {
    fakeDb.__queue('returning', [
      { id: 1, name: 'Ghosts' },
      { id: 2, name: 'Vapors' },
    ])

    const res = await callPost({ categories: ['Ghosts', 'Vapors'] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      categories: [
        { id: 1, name: 'Ghosts' },
        { id: 2, name: 'Vapors' },
      ],
    })

    expect(fakeDb.insert).toHaveBeenCalledOnce()
    const inserted = vi.mocked(fakeDb.values).mock.calls[0][0] as Array<{
      name: string
      icon: string
    }>
    expect(inserted).toHaveLength(2)
    expect(inserted[0]).toMatchObject({ name: 'Ghosts', icon: 'questionMark' })
    expect(inserted[1]).toMatchObject({ name: 'Vapors', icon: 'questionMark' })
  })

  it('returns the catch-all error response when DB throws', async () => {
    vi.mocked(fakeDb.values).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const res = await callPost({ categories: ['One'] })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.categories).toEqual(['Failed to create categories'])
  })
})
