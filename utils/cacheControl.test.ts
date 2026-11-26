import { describe, expect, it } from 'vitest'
import { CACHE_CONTROL } from '@/constants'
import { pageCacheControl } from './cacheControl'

const root = (loaderData: unknown) => ({ routeId: '__root__', loaderData })
const page = { routeId: '/', loaderData: [1] }

describe('pageCacheControl', () => {
  it('caches a cacheable page whose categories loaded', () => {
    expect(pageCacheControl(true, [root([{ id: 1 }]), page])).toEqual({
      'Cache-Control': CACHE_CONTROL.PAGE,
    })
  })

  it.each([
    ['the page says no', false, [root([{ id: 1 }]), page]],
    ['categories degraded to []', true, [root([]), page]],
    ['the root match is missing', true, [page]],
  ])('sends no-store when %s', (_label, cacheable, matches) => {
    expect(pageCacheControl(cacheable as boolean, matches)).toEqual({
      'Cache-Control': CACHE_CONTROL.NO_STORE,
    })
  })
})
