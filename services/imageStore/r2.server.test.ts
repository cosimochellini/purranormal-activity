import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { imageStore } from './r2.server'

// `r2.server.ts` is the single line that names the binding. Everything else is
// covered against a fake bucket in `imageStore.test.ts`, so the only thing
// asserted here is that the exported store really reaches `env.IMAGES` — a
// wrong binding key would otherwise be caught by `tsc` alone.
const put = vi.fn(async () => ({}))
const del = vi.fn(async () => undefined)

beforeEach(() => {
  put.mockClear()
  del.mockClear()
  // Assigned after import on purpose: the factory takes a bucket *accessor*, so
  // the binding is read per call rather than at module evaluation — which is
  // what keeps the module import side-effect free on Workers.
  env.IMAGES = { put, delete: del } as unknown as R2Bucket
})

describe('imageStore (bound to env.IMAGES)', () => {
  it('routes put through the IMAGES binding', async () => {
    await imageStore.put(5, new Uint8Array([7]))

    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0][0]).toBe('5/cover.webp')
  })

  it('routes delete through the IMAGES binding', async () => {
    await imageStore.delete(5)

    expect(del).toHaveBeenCalledWith('5/cover.webp')
  })
})
