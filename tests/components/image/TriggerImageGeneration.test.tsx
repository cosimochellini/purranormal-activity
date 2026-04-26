/** @vitest-environment happy-dom */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetcherImpl } = vi.hoisted(() => ({ fetcherImpl: vi.fn() }))
vi.mock('@/utils/fetch', () => ({
  fetcher: () => fetcherImpl,
}))

import { TriggerImageGeneration } from '@/components/image/TriggerImageGeneration'
import { logger } from '@/utils/logger'

const log = {
  id: 7,
  title: 't',
  description: 'd',
  imageDescription: '',
  status: 'Created',
  error: null,
  createdAt: 0,
  updatedAt: 0,
  categories: [],
}

beforeEach(() => {
  fetcherImpl.mockReset()
  vi.mocked(logger.error).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('TriggerImageGeneration', () => {
  it('renders nothing — relies on fetcher invalidation, not <Refetch>', async () => {
    fetcherImpl.mockResolvedValueOnce({ success: true })

    const { container } = render(<TriggerImageGeneration log={log as never} />)

    await waitFor(() => {
      expect(fetcherImpl).toHaveBeenCalledWith({ params: { id: 7 } })
    })

    // No DOM nodes — the polling component is gone.
    expect(container.firstChild).toBeNull()
  })

  it('skips the trigger entirely for non-Created logs', () => {
    render(<TriggerImageGeneration log={{ ...log, status: 'ImageGenerated' } as never} />)
    expect(fetcherImpl).not.toHaveBeenCalled()
  })

  it('logs the failure when the trigger rejects (Bug #4 regression)', async () => {
    fetcherImpl.mockRejectedValueOnce(new Error('trigger failed'))

    render(<TriggerImageGeneration log={log as never} />)

    await waitFor(() => {
      expect(vi.mocked(logger.error)).toHaveBeenCalled()
    })
    expect(vi.mocked(logger.error).mock.calls[0][0]).toMatch(/trigger image generation/i)
  })
})
