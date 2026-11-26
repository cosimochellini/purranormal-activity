import { describe, expect, it, vi } from 'vitest'
import { type InvalidationTag, invalidateTags, matchesTags } from './invalidation'

const home = { routeId: '/', params: {} as Record<string, string> }
const explore = { routeId: '/explore', params: {} as Record<string, string> }
const detail = (id: string) => ({ routeId: '/$id/', params: { id } })
const edit = (id: string) => ({ routeId: '/$id/edit', params: { id } })
const apiRoute = { routeId: '/api/log/$id', params: { id: '7' } }
const newRoute = { routeId: '/new', params: {} as Record<string, string> }

describe('matchesTags', () => {
  it('returns false for an empty tag list', () => {
    expect(matchesTags(home, [])).toBe(false)
    expect(matchesTags(detail('7'), [])).toBe(false)
  })

  it('"logs" matches the home and explore loaders only', () => {
    expect(matchesTags(home, ['logs'])).toBe(true)
    expect(matchesTags(explore, ['logs'])).toBe(true)
    expect(matchesTags(detail('7'), ['logs'])).toBe(false)
    expect(matchesTags(edit('7'), ['logs'])).toBe(false)
    expect(matchesTags(apiRoute, ['logs'])).toBe(false)
    expect(matchesTags(newRoute, ['logs'])).toBe(false)
  })

  it('"log:N" matches /$id/ and /$id/edit only when params.id is N', () => {
    expect(matchesTags(detail('7'), ['log:7'])).toBe(true)
    expect(matchesTags(edit('7'), ['log:7'])).toBe(true)

    expect(matchesTags(detail('8'), ['log:7'])).toBe(false)
    expect(matchesTags(edit('8'), ['log:7'])).toBe(false)

    expect(matchesTags(home, ['log:7'])).toBe(false)
    expect(matchesTags(explore, ['log:7'])).toBe(false)
  })

  it('mixed tags match if ANY tag matches the route', () => {
    expect(matchesTags(home, ['logs', 'log:7'])).toBe(true)
    expect(matchesTags(detail('7'), ['logs', 'log:7'])).toBe(true)
    expect(matchesTags(detail('99'), ['logs', 'log:7'])).toBe(false)
  })

  it('ignores unknown tags rather than throwing', () => {
    expect(matchesTags(home, ['mystery' as unknown as InvalidationTag])).toBe(false)
    expect(matchesTags(home, ['log:' as unknown as InvalidationTag])).toBe(false)
    expect(matchesTags(detail('7'), ['log:' as unknown as InvalidationTag])).toBe(false)
  })

  it('does not match a detail route when params.id is missing', () => {
    const orphan = { routeId: '/$id/' } as { routeId: string; params?: Record<string, string> }
    expect(matchesTags(orphan, ['log:7'])).toBe(false)
  })
})

describe('invalidateTags', () => {
  it('invalidates only the matches the tags select', async () => {
    const invalidate = vi.fn().mockResolvedValue(undefined)
    await invalidateTags({ invalidate }, ['log:7'])

    const { filter } = invalidate.mock.calls[0][0] as { filter: (m: unknown) => boolean }
    expect(filter({ routeId: '/$id/', params: { id: '7' } })).toBe(true)
    expect(filter({ routeId: '/$id/', params: { id: '8' } })).toBe(false)
    expect(filter({ routeId: '/', params: {} })).toBe(false)
  })
})
