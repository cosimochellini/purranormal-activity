export function startViewTransition(callback: () => void) {
  if (!(document).startViewTransition) {
    callback()
    return
  }

  (document).startViewTransition(callback)
}

export function transitions(id: number) {
  return {
    image: { viewTransitionName: `event-image-${id}` },
    title: { viewTransitionName: `event-title-${id}` },
    description: { viewTransitionName: `event-description-${id}` },
    categories: { viewTransitionName: `event-categories-${id}` },
  } as const
}
