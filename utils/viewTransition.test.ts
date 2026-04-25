import { describe, expect, it } from 'vitest'
import { transitions } from './viewTransition'

describe('transitions', () => {
  it('returns the expected name map for a given id', () => {
    expect(transitions(7)).toEqual({
      image: { viewTransitionName: 'event-image-7' },
      title: { viewTransitionName: 'event-title-7' },
      description: { viewTransitionName: 'event-description-7' },
      categories: { viewTransitionName: 'event-categories-7' },
    })
  })

  it('produces unique view-transition names per id', () => {
    const a = transitions(1)
    const b = transitions(2)
    expect(a.image.viewTransitionName).not.toBe(b.image.viewTransitionName)
    expect(a.title.viewTransitionName).not.toBe(b.title.viewTransitionName)
  })

  it('handles 0 as a valid id', () => {
    expect(transitions(0)).toEqual({
      image: { viewTransitionName: 'event-image-0' },
      title: { viewTransitionName: 'event-title-0' },
      description: { viewTransitionName: 'event-description-0' },
      categories: { viewTransitionName: 'event-categories-0' },
    })
  })
})
