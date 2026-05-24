import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/utils/logger'

// Mirror the boundary-mocking style of the deleted `utils/cloudflare.test.ts`:
// the S3 SDK is fully stubbed so the lazy client constructed inside
// `services/imageStore` never reaches a real R2 endpoint, and the command
// constructors are spied so we can assert on the key scheme.
vi.mock('@/env/server', () => ({
  serverEnv: {
    accountId: 'fake-account',
    accessKeyId: 'fake-access',
    secretAccessKey: 'fake-secret',
  },
  bucket: {
    name: 'fake-bucket',
    url: 'https://fake-account.r2.cloudflarestorage.com',
  },
}))

vi.mock('@/env/public', () => ({
  VITE_APP_URL: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  VITE_CLOUDFLARE_PUBLIC_URL: 'images.example.com',
}))

const sendMock = vi.fn(async () => ({}))

vi.mock('@aws-sdk/client-s3', () => {
  const PutObjectCommand = vi.fn(function PutObjectCommandCtor(
    this: { input: unknown },
    input: unknown,
  ) {
    this.input = input
    return Object.assign(this, { __type: 'Put', input })
  })
  const DeleteObjectCommand = vi.fn(function DeleteObjectCommandCtor(
    this: { input: unknown },
    input: unknown,
  ) {
    this.input = input
    return Object.assign(this, { __type: 'Delete', input })
  })
  const S3Client = vi.fn(function S3ClientCtor(this: { send: typeof sendMock }) {
    this.send = sendMock
    return this
  })
  return { PutObjectCommand, DeleteObjectCommand, S3Client }
})

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { imageStore } from './index'

const putMock = vi.mocked(PutObjectCommand) as unknown as ReturnType<typeof vi.fn>
const deleteMock = vi.mocked(DeleteObjectCommand) as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockImplementation(async () => ({}))
  putMock.mockClear()
  deleteMock.mockClear()
})

describe('imageStore.put', () => {
  it('writes the configured key with a Buffer body and image/webp content type', async () => {
    await imageStore.put(99, new Uint8Array([1, 2, 3]))

    expect(putMock).toHaveBeenCalledTimes(1)
    const [putArgs] = putMock.mock.calls[0] as [
      { Bucket: string; Key: string; Body: unknown; ContentType: string },
    ]
    expect(putArgs.Bucket).toBe('fake-bucket')
    expect(putArgs.Key).toBe('99/cover.webp')
    expect(putArgs.ContentType).toBe('image/webp')
    // Body is wrapped in a Node Buffer (polyfilled on Workers).
    expect(putArgs.Body).toBeInstanceOf(Uint8Array)
    expect(Array.from(putArgs.Body as Uint8Array)).toEqual([1, 2, 3])

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toMatchObject({ __type: 'Put' })
  })

  it('wraps S3 errors with the documented `R2 upload failed:` prefix', async () => {
    sendMock.mockRejectedValueOnce(new Error('s3 down'))
    await expect(imageStore.put(1, new Uint8Array([0]))).rejects.toThrow(
      'R2 upload failed: s3 down',
    )
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error uploading to R2:',
      expect.any(Error),
    )
  })
})

describe('imageStore.delete', () => {
  it('deletes the configured key', async () => {
    await imageStore.delete(7)

    expect(deleteMock).toHaveBeenCalledWith({
      Bucket: 'fake-bucket',
      Key: '7/cover.webp',
    })
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toMatchObject({ __type: 'Delete' })
  })

  it('wraps S3 errors with the generic delete-failed message', async () => {
    sendMock.mockRejectedValueOnce(new Error('boom'))
    await expect(imageStore.delete(7)).rejects.toThrow('Failed to delete object from R2')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error deleting object from R2:',
      expect.any(Error),
    )
  })
})

describe('imageStore.publicUrl', () => {
  it('returns the canonical R2 URL for a given id', () => {
    expect(imageStore.publicUrl(42)).toBe('https://images.example.com/42/cover.webp')
    expect(imageStore.publicUrl(0)).toBe('https://images.example.com/0/cover.webp')
    expect(imageStore.publicUrl(123456)).toBe('https://images.example.com/123456/cover.webp')
  })
})

describe('imageStore.publicUrl with empty VITE_CLOUDFLARE_PUBLIC_URL', () => {
  it('returns an empty string when the env value is empty', async () => {
    vi.resetModules()
    vi.doMock('@/env/public', () => ({
      VITE_APP_URL: 'http://localhost:5173',
      APP_URL: 'http://localhost:5173',
      VITE_CLOUDFLARE_PUBLIC_URL: '',
    }))
    const { imageStore: rebuilt } = await import('./index')
    expect(rebuilt.publicUrl(7)).toBe('')
    vi.doUnmock('@/env/public')
    vi.resetModules()
  })
})
