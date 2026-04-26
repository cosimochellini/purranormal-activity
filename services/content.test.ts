import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'

vi.mock('@/services/log', () => ({
  getLog: vi.fn(),
  setLogError: vi.fn(async () => undefined),
}))

vi.mock('@/services/trigger', () => ({
  triggerLogImageIfPending: vi.fn(),
  triggerFirstPendingImage: vi.fn(),
}))

import { regenerateContents } from '@/services/content'
import { getLog, setLogError } from '@/services/log'
import { triggerFirstPendingImage, triggerLogImageIfPending } from '@/services/trigger'

describe('regenerateContents', () => {
  beforeEach(() => {
    vi.mocked(getLog).mockReset()
    vi.mocked(setLogError).mockReset()
    vi.mocked(setLogError).mockImplementation(async () => undefined)
    vi.mocked(triggerLogImageIfPending).mockReset()
    vi.mocked(triggerFirstPendingImage).mockReset()
  })

  it('returns imageTriggered:false and skips triggers when triggerImages is false', async () => {
    const result = await regenerateContents({ triggerImages: false })
    expect(result).toEqual({ imageTriggered: false })
    expect(triggerLogImageIfPending).not.toHaveBeenCalled()
    expect(triggerFirstPendingImage).not.toHaveBeenCalled()
  })

  it('returns imageTriggered:true when triggerLogImageIfPending succeeds', async () => {
    vi.mocked(triggerLogImageIfPending).mockResolvedValueOnce(true)

    const result = await regenerateContents({ triggerLogId: 7 })
    expect(result).toEqual({ imageTriggered: true })
    expect(triggerLogImageIfPending).toHaveBeenCalledWith(7)
    expect(triggerFirstPendingImage).not.toHaveBeenCalled()
  })

  it('falls back to triggerFirstPendingImage when the targeted log is not pending', async () => {
    vi.mocked(triggerLogImageIfPending).mockResolvedValueOnce(false)
    vi.mocked(triggerFirstPendingImage).mockResolvedValueOnce(true)

    const result = await regenerateContents({ triggerLogId: 7 })
    expect(result).toEqual({ imageTriggered: true })
    expect(triggerLogImageIfPending).toHaveBeenCalledWith(7)
    expect(triggerFirstPendingImage).toHaveBeenCalledOnce()
    expect(setLogError).not.toHaveBeenCalled()
  })

  it('marks the targeted log as errored when neither trigger fires and the log is still Created', async () => {
    vi.mocked(triggerLogImageIfPending).mockResolvedValueOnce(false)
    vi.mocked(triggerFirstPendingImage).mockResolvedValueOnce(false)
    vi.mocked(getLog).mockResolvedValueOnce({
      id: 7,
      status: LogStatus.Created,
    } as never)

    const result = await regenerateContents({ triggerLogId: 7 })
    expect(result).toEqual({ imageTriggered: false })
    expect(setLogError).toHaveBeenCalledWith(7, expect.any(Error))
  })

  it('does NOT mark as errored when neither trigger fires but the log is no longer in Created state', async () => {
    vi.mocked(triggerLogImageIfPending).mockResolvedValueOnce(false)
    vi.mocked(triggerFirstPendingImage).mockResolvedValueOnce(false)
    vi.mocked(getLog).mockResolvedValueOnce({
      id: 7,
      status: LogStatus.ImageGenerated,
    } as never)

    const result = await regenerateContents({ triggerLogId: 7 })
    expect(result).toEqual({ imageTriggered: false })
    expect(setLogError).not.toHaveBeenCalled()
  })

  it('records the error on the targeted log when the trigger throws', async () => {
    const failure = new Error('trigger failed')
    vi.mocked(triggerLogImageIfPending).mockRejectedValueOnce(failure)
    vi.mocked(getLog).mockResolvedValueOnce({
      id: 7,
      status: LogStatus.Created,
    } as never)

    const result = await regenerateContents({ triggerLogId: 7 })
    expect(result).toEqual({ imageTriggered: false })
    expect(setLogError).toHaveBeenCalledWith(7, failure)
  })

  it('does not call setLogError when no triggerLogId was supplied (orphan run)', async () => {
    vi.mocked(triggerFirstPendingImage).mockResolvedValueOnce(true)

    const result = await regenerateContents({})
    expect(result).toEqual({ imageTriggered: true })
    expect(triggerLogImageIfPending).not.toHaveBeenCalled()
    expect(triggerFirstPendingImage).toHaveBeenCalledOnce()
    expect(setLogError).not.toHaveBeenCalled()
  })
})
