/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as React from 'react'
import { Suspense } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../../static/promise', () => ({
  getCategories: () =>
    Promise.resolve([
      { id: 1, name: 'Spectral', icon: 'questionMark' },
      { id: 2, name: 'Phantom', icon: 'questionMark' },
    ]),
}))

import { Category } from '@/components/common/Category'

afterEach(() => {
  cleanup()
})

// Pre-warm: the Category component lazily imports its Icons module the first
// time it renders. Resolving that here makes per-test renders deterministic.
beforeAll(async () => {
  await import('@/components/common/Category/Icons')
})

const renderCategory = async (props: React.ComponentProps<typeof Category>) => {
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <Suspense fallback={<div data-testid="suspense-fallback">loading…</div>}>
        <Category {...props} />
      </Suspense>,
    )
  })
  return result
}

describe('Category', () => {
  it('clicking fires the onClick handler', async () => {
    const onClick = vi.fn()
    await renderCategory({ category: 2, onClick })

    const btn = await screen.findByRole('button', undefined, { timeout: 3000 })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the category name and a clickable button', async () => {
    await renderCategory({ category: 1, selected: false })

    // Wait for suspense to resolve (icons + categories promises)
    const btn = await screen.findByRole('button', undefined, { timeout: 3000 })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn.textContent).toContain('Spectral')
  })

  it('reflects selected state via aria-pressed', async () => {
    await renderCategory({ category: 1, selected: true })
    const btn = await screen.findByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn.getAttribute('aria-label')).toMatch(/Deselect Spectral/i)
  })

  it('iconOnly hides the name text inside the button', async () => {
    await renderCategory({ category: 1, iconOnly: true })
    const btn = await screen.findByRole('button')
    // When iconOnly is true, the <span> with the name is NOT rendered inside the button.
    // The name still exists in the (sibling) tooltip element. Scope to button only.
    const innerSpans = btn.querySelectorAll('span')
    expect(innerSpans.length).toBe(0)
  })
})
