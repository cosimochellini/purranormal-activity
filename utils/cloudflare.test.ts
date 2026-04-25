import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetchOnce, mockFetchReject } from '@/tests/helpers'
import { logger } from '@/utils/logger'

vi.mock('@/env/cloudflare', () => ({
  ACCOUNT_ID: 'fake-account',
  ACCESS_KEY_ID: 'fake-access',
  SECRET_ACCESS_KEY: 'fake-secret',
  BUCKET_NAME: 'fake-bucket',
  BUCKET_URL: 'https://fake-account.r2.cloudflarestorage.com',
  CLOUDFLARE_IMAGE_TOKEN: 'fake-token',
}))

vi.mock('@/instances/s3', () => ({
  S3: { send: vi.fn(async () => ({})) },
}))

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
  return {
    PutObjectCommand,
    DeleteObjectCommand,
    S3Client: vi.fn(),
  }
})

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { S3 } from '@/instances/s3'
import { deleteFromR2, uploadToCloudflareImages, uploadToR2 } from './cloudflare'

const s3Send = vi.mocked(S3.send) as ReturnType<typeof vi.fn>
const putMock = vi.mocked(PutObjectCommand) as unknown as ReturnType<typeof vi.fn>
const deleteMock = vi.mocked(DeleteObjectCommand) as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  s3Send.mockReset()
  s3Send.mockImplementation(async () => ({}))
  putMock.mockClear()
  deleteMock.mockClear()
})

describe('uploadToCloudflareImages', () => {
  it('POSTs to the Cloudflare API with the configured token and a FormData body', async () => {
    mockFetchOnce({ success: true, result: { id: 'img-1' } })
    const result = await uploadToCloudflareImages('https://example.com/x.png', { foo: 'bar' })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.cloudflare.com/client/v4/accounts/fake-account/images/v1')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer fake-token' })
    expect(init.body).toBeInstanceOf(FormData)
    const fd = init.body as FormData
    expect(fd.get('url')).toBe('https://example.com/x.png')
    expect(fd.get('requireSignedURLs')).toBe('false')
    expect(fd.get('metadata')).toBe(JSON.stringify({ foo: 'bar' }))

    expect(result).toMatchObject({ success: true })
  })

  it('omits metadata when not provided', async () => {
    mockFetchOnce({ success: true })
    await uploadToCloudflareImages('https://example.com/x.png')

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [, init] = fetchMock.mock.calls[0]
    const fd = init.body as FormData
    expect(fd.get('metadata')).toBeNull()
  })

  it('logs and throws when the response is not ok', async () => {
    mockFetchOnce({ errors: ['nope'] }, { status: 500 })
    await expect(uploadToCloudflareImages('https://example.com/x.png')).rejects.toThrow(
      'Cloudflare Images upload failed',
    )
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error uploading to Cloudflare Images:',
      expect.any(Error),
    )
  })

  it('logs and throws when fetch itself rejects', async () => {
    mockFetchReject(new Error('network'))
    await expect(uploadToCloudflareImages('https://example.com/x.png')).rejects.toThrow(
      'Cloudflare Images upload failed',
    )
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })
})

describe('uploadToR2', () => {
  it('forwards a PutObjectCommand to S3 with the right key and body', async () => {
    const buf = Buffer.from('image-bytes')
    await uploadToR2(buf, 99)

    expect(putMock).toHaveBeenCalledWith({
      Bucket: 'fake-bucket',
      Key: '99/cover.webp',
      Body: buf,
      ContentType: 'image/webp',
    })
    expect(s3Send).toHaveBeenCalledTimes(1)
    expect(s3Send.mock.calls[0][0]).toMatchObject({ __type: 'Put' })
  })

  it('logs and wraps the error with context when S3 send rejects', async () => {
    s3Send.mockRejectedValueOnce(new Error('s3 down'))
    await expect(uploadToR2(Buffer.from('x'), 1)).rejects.toThrow('R2 upload failed: s3 down')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error uploading to R2:',
      expect.any(Error),
    )
  })
})

describe('deleteFromR2', () => {
  it('forwards a DeleteObjectCommand to S3 with the right key', async () => {
    await deleteFromR2(7)

    expect(deleteMock).toHaveBeenCalledWith({
      Bucket: 'fake-bucket',
      Key: '7/cover.webp',
    })
    expect(s3Send).toHaveBeenCalledTimes(1)
    expect(s3Send.mock.calls[0][0]).toMatchObject({ __type: 'Delete' })
  })

  it('logs and throws a generic error when S3 send rejects', async () => {
    s3Send.mockRejectedValueOnce(new Error('boom'))
    await expect(deleteFromR2(7)).rejects.toThrow('Failed to delete object from R2')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error deleting object from R2:',
      expect.any(Error),
    )
  })
})
