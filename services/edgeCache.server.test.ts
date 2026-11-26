import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_CONTROL } from '@/constants'
import { purgePages, withEdgeCache } from './edgeCache.server'

const PAGE_CACHE_CONTROL = CACHE_CONTROL.PAGE

const store = new Map<string, Response>()
const fakeCache = {
  match: vi.fn(async (req: Request) => store.get(req.url)?.clone()),
  put: vi.fn(async (req: Request, res: Response) => {
    store.set(req.url, res)
  }),
  delete: vi.fn(async (req: Request) => store.delete(req.url)),
}

const ctx = { waitUntil: vi.fn() }
const page = (cacheControl?: string, status = 200) =>
  new Response('<html>page</html>', {
    status,
    headers: cacheControl ? { 'Cache-Control': cacheControl } : {},
  })

const flush = () => Promise.all(ctx.waitUntil.mock.calls.map(([p]) => p))

beforeEach(() => {
  store.clear()
  fakeCache.match.mockImplementation(async (req: Request) => store.get(req.url)?.clone())
  fakeCache.put.mockImplementation(async (req: Request, res: Response) => {
    store.set(req.url, res)
  })
  fakeCache.delete.mockImplementation(async (req: Request) => store.delete(req.url))
  ctx.waitUntil.mockImplementation(() => {})
  vi.stubGlobal('caches', { default: fakeCache })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('withEdgeCache', () => {
  it('caches a page that opts in, then serves it without rendering', async () => {
    const render = vi.fn(() => page(PAGE_CACHE_CONTROL))
    const req = () => new Request('https://kitten.test/7')

    expect(await (await withEdgeCache(req(), ctx, render)).text()).toBe('<html>page</html>')
    await flush()
    expect(await (await withEdgeCache(req(), ctx, render)).text()).toBe('<html>page</html>')

    expect(render).toHaveBeenCalledTimes(1)
    // The key carries the build id so a deploy never serves old asset links.
    expect([...store.keys()][0]).toBe(`https://kitten.test/7?__build=${__BUILD_ID__}`)
  })

  it.each([
    ['no s-maxage', page()],
    ['no-store', page('no-store')],
    ['a non-200 status', page(PAGE_CACHE_CONTROL, 404)],
  ])('does not cache a response with %s', async (_label, response) => {
    await withEdgeCache(new Request('https://kitten.test/'), ctx, () => response)
    expect(fakeCache.put).not.toHaveBeenCalled()
  })

  it.each([
    new Request('https://kitten.test/', { method: 'POST' }),
    new Request('https://kitten.test/_serverFn/abc'),
    new Request('https://kitten.test/api/script'),
    new Request('https://kitten.test/', { headers: { 'x-tsr-serverFn': 'true' } }),
    // Query-string variants can't be purged by path, so they are never cached.
    new Request('https://kitten.test/?utm_source=x'),
  ])('bypasses the cache for $url ($method)', async (request) => {
    const render = vi.fn(() => page(PAGE_CACHE_CONTROL))
    await withEdgeCache(request, ctx, render)
    expect(fakeCache.match).not.toHaveBeenCalled()
    expect(fakeCache.put).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledOnce()
  })

  it('renders when the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined)
    const render = vi.fn(() => page(PAGE_CACHE_CONTROL))
    await withEdgeCache(new Request('https://kitten.test/'), ctx, render)
    expect(render).toHaveBeenCalledOnce()
  })

  it('falls back to rendering when the cache lookup throws', async () => {
    fakeCache.match.mockRejectedValueOnce(new Error('cache down'))
    const render = vi.fn(() => page())
    const res = await withEdgeCache(new Request('https://kitten.test/'), ctx, render)
    expect(res.status).toBe(200)
    expect(render).toHaveBeenCalledOnce()
  })
})

describe('purgePages', () => {
  it('deletes the build-keyed entry of each path', async () => {
    await withEdgeCache(new Request('https://kitten.test/7'), ctx, () => page(PAGE_CACHE_CONTROL))
    await flush()
    expect(store.size).toBe(1)

    await purgePages('https://kitten.test', ['/', '/7'])

    expect(store.size).toBe(0)
    expect(fakeCache.delete).toHaveBeenCalledTimes(2)
  })

  it('swallows delete failures', async () => {
    fakeCache.delete.mockRejectedValueOnce(new Error('nope'))
    await expect(purgePages('https://kitten.test', ['/'])).resolves.toBeUndefined()
  })
})
