import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

vi.mock('@/services/notifier', () => ({ notifier: {} }))
vi.mock('@/services/log', () => ({ getLog: vi.fn(), getLogs: vi.fn() }))
vi.mock('@/services/storyForge', () => ({ storyForge: {} }))

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    enqueue: vi.fn(async () => true),
  },
}))

vi.mock('@/services/imageStore/r2.server', () => ({
  imageStore: {
    put: vi.fn(),
    delete: vi.fn(async () => undefined),
  },
}))

import { imagePipeline } from '@/services/imagePipeline'
import { imageStore } from '@/services/imageStore/r2.server'
import { deleteLog, updateLog } from '@/services/logActions.server'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

type Failure = { success: false; errors: Record<string, string[]> }

const validInput = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  title: 'New title',
  description: 'New description content',
  categories: [1],
  imageDescription: 'new image desc',
  ...overrides,
})

describe('updateLog', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(imagePipeline.enqueue).mockClear()
  })

  it.each([
    ['a non-numeric id', 'nope'],
    ['a zero id', 0],
    ['a negative id', -3],
    ['a fractional id', 1.5],
    ['a missing id', undefined],
  ])('returns an id field error for %s without touching the DB', async (_label, id) => {
    const result = (await updateLog(validInput({ id }))) as Failure

    expect(result.success).toBe(false)
    expect(result.errors.id?.length).toBeGreaterThan(0)
    expect(fakeDb.select).not.toHaveBeenCalled()
    expect(imagePipeline.enqueue).not.toHaveBeenCalled()
  })

  it('returns flattened field errors when validation fails', async () => {
    const result = (await updateLog({
      id: 7,
      title: '',
      description: '',
      categories: [],
      imageDescription: null,
    })) as Failure

    expect(result.success).toBe(false)
    expect(result.errors.title?.length).toBeGreaterThan(0)
    expect(result.errors.description?.length).toBeGreaterThan(0)
    expect(result.errors.categories?.length).toBeGreaterThan(0)
    expect(result.errors.secret).toBeUndefined()
    // Validation failure -> no row looked up, mutated or enqueued.
    expect(fakeDb.select).not.toHaveBeenCalled()
    expect(fakeDb.update).not.toHaveBeenCalled()
    expect(imagePipeline.enqueue).not.toHaveBeenCalled()
  })

  it('reports an id error together with the other field errors when both fail', async () => {
    const result = (await updateLog({
      id: 'nope',
      title: '',
      description: '',
      categories: [],
      imageDescription: null,
    })) as Failure

    expect(result.success).toBe(false)
    expect(result.errors.id?.length).toBeGreaterThan(0)
    expect(result.errors.title?.length).toBeGreaterThan(0)
  })

  it('returns "Log not found" when no row matches the id', async () => {
    // After validation passes, the action looks up the existing log.
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)

    const result = (await updateLog(validInput({ imageDescription: 'desc' }))) as Failure

    expect(result.success).toBe(false)
    expect(result.errors.title).toEqual(['Log not found'])
    expect(fakeDb.update).not.toHaveBeenCalled()
    expect(imagePipeline.enqueue).not.toHaveBeenCalled()
  })

  it('updates the log, replaces categories, and enqueues regeneration on success', async () => {
    const existing = { id: 7, status: 'Created', imageDescription: 'old' }
    const updated = { id: 7, status: 'Created' }

    // 1) lookup existing log
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    // 2) update log .returning() resolves
    fakeDb.__queue('returning', [updated])

    const result = await updateLog(validInput({ categories: [1, 2] }))

    expect(result).toEqual({ success: true, data: updated })

    expect(fakeDb.update).toHaveBeenCalled()
    expect(fakeDb.delete).toHaveBeenCalled()
    expect(fakeDb.insert).toHaveBeenCalled()
    expect(fakeDb.values).toHaveBeenCalledWith([
      { logId: 7, categoryId: 1 },
      { logId: 7, categoryId: 2 },
    ])
    expect(imagePipeline.enqueue).toHaveBeenCalledWith(7, 'update')
    // A new prompt is a new generation cycle, so the attempt budget and the
    // previous failure text must be cleared alongside the status flip.
    expect(fakeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Created', attempts: 0, error: null }),
    )
  })

  it('flips an already-generated row back to Created and resets attempts when the prompt changes', async () => {
    const existing = { id: 7, status: 'ImageGenerated', imageDescription: 'old' }
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    fakeDb.__queue('returning', [{ id: 7, status: 'Created' }])

    await updateLog(validInput({ imageDescription: 'brand new prompt' }))

    expect(fakeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Created', attempts: 0, error: null }),
    )
    expect(imagePipeline.enqueue).toHaveBeenCalledWith(7, 'update')
  })

  it('does NOT enqueue when the prompt is unchanged and the row already has its image', async () => {
    // The pre-queue code called the pipeline unconditionally and relied on its
    // `not-pending` skip; under a queue that costs a message plus a DB read.
    const existing = { id: 7, status: 'ImageGenerated', imageDescription: 'same' }
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    fakeDb.__queue('returning', [{ id: 7, status: 'ImageGenerated' }])

    const result = await updateLog(validInput({ categories: [1], imageDescription: 'same' }))

    expect(result).toMatchObject({ success: true })
    expect(imagePipeline.enqueue).not.toHaveBeenCalled()
    // Status is kept and the attempt budget is left alone.
    const patch = vi.mocked(fakeDb.set).mock.calls[0]?.[0]
    expect(patch).toMatchObject({ status: 'ImageGenerated' })
    expect(patch).not.toHaveProperty('attempts')
    expect(patch).not.toHaveProperty('error')
  })

  it('DOES enqueue an unchanged prompt when the row is still pending', async () => {
    const existing = { id: 7, status: 'Created', imageDescription: 'same' }
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    fakeDb.__queue('returning', [{ id: 7, status: 'Created' }])

    await updateLog(validInput({ imageDescription: 'same' }))

    expect(imagePipeline.enqueue).toHaveBeenCalledWith(7, 'update')
  })

  it('returns the catch-all error response when the DB update throws', async () => {
    vi.mocked(fakeDb.where).mockImplementationOnce(() => {
      throw new Error('db down')
    })

    const result = (await updateLog(validInput({ imageDescription: null }))) as Failure

    expect(result.success).toBe(false)
    expect(result.errors.title).toEqual(['Failed to update log'])
  })
})

describe('deleteLog', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(imageStore.delete).mockClear()
  })

  it.each([
    ['NaN', Number.NaN],
    ['zero', 0],
    ['a negative id', -1],
    ['a fractional id', 1.5],
  ])('rejects %s without touching the DB or R2', async (_label, id) => {
    expect(await deleteLog(id)).toEqual({ success: false, error: 'Invalid log id' })
    expect(fakeDb.delete).not.toHaveBeenCalled()
    expect(imageStore.delete).not.toHaveBeenCalled()
  })

  it('deletes the log row and the R2 image on success', async () => {
    expect(await deleteLog(7)).toEqual({ success: true })
    expect(fakeDb.delete).toHaveBeenCalled()
    expect(imageStore.delete).toHaveBeenCalledWith(7)
  })

  it('returns the catch-all error response when deletion throws', async () => {
    vi.mocked(imageStore.delete).mockRejectedValueOnce(new Error('r2 down'))

    expect(await deleteLog(7)).toEqual({ success: false, error: 'Failed to delete log' })
  })
})
