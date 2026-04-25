/** @vitest-environment happy-dom */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetcherImpl } = vi.hoisted(() => ({ fetcherImpl: vi.fn() }))
vi.mock('@/utils/fetch', () => ({
  fetcher: () => fetcherImpl,
}))

const { refetchSpy } = vi.hoisted(() => ({ refetchSpy: vi.fn() }))
vi.mock('@/components/timer/refetch', () => ({
  Refetch: ({ shouldRefetch }: { shouldRefetch: boolean }) => {
    refetchSpy(shouldRefetch)
    return <div data-testid="refetch" data-should={shouldRefetch ? 'true' : 'false'} />
  },
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
  refetchSpy.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('TriggerImageGeneration — Bug #4 regression', () => {
  it('does NOT set shouldRefetch=true when trigger API rejects', async () => {
    fetcherImpl.mockRejectedValueOnce(new Error('trigger failed'))

    render(<TriggerImageGeneration log={log as never} />)

    await waitFor(() => {
      expect(fetcherImpl).toHaveBeenCalled()
    })

    // Allow promise micro-tasks to flush
    await waitFor(() => {
      expect(vi.mocked(logger.error)).toHaveBeenCalled()
    })

    // Refetch should never have been told true
    const allCalls = refetchSpy.mock.calls.map((c) => c[0])
    expect(allCalls).not.toContain(true)
  })

  it('sets shouldRefetch=true on resolve', async () => {
    fetcherImpl.mockResolvedValueOnce({ success: true })

    render(<TriggerImageGeneration log={log as never} />)

    await waitFor(() => {
      const calls = refetchSpy.mock.calls.map((c) => c[0])
      expect(calls).toContain(true)
    })
  })
})
