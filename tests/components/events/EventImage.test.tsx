/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('a', rest as Record<string, unknown>, children),
}))

import { EventImage } from '@/components/events/EventImage'
import { logger } from '@/utils/logger'

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
})

const log = {
  id: 99,
  title: 't',
  description: 'd',
  imageDescription: 'alt-text',
  status: 'imageGenerated',
  error: null,
  createdAt: 0,
  updatedAt: 0,
  categories: [],
}

describe('EventImage — Bug #10 regression', () => {
  it('logs nav rejection AND surfaces visible UI state (data-nav-error)', async () => {
    navigateMock.mockRejectedValue(new Error('nav failed'))

    const { container } = render(<EventImage log={log as never} />)

    const img = screen.getByAltText('alt-text')
    // 5 clicks triggers navigation
    for (let i = 0; i < 5; i += 1) fireEvent.click(img)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(vi.mocked(logger.error)).toHaveBeenCalled()
    })

    // The error must be passed to the logger (propagated, not swallowed)
    const calls = vi.mocked(logger.error).mock.calls.flat()
    const hasNavError = calls.some((a) => a instanceof Error && a.message === 'nav failed')
    expect(hasNavError).toBe(true)

    // UI state cue is visible
    await waitFor(() => {
      const wrapper = container.querySelector('[data-nav-error="true"]')
      expect(wrapper).toBeTruthy()
    })
  })
})
