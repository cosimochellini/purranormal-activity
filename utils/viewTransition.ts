export function transitions<const Id extends number>(id: Id) {
  return {
    image: { viewTransitionName: `event-image-${id}` },
    title: { viewTransitionName: `event-title-${id}` },
    description: { viewTransitionName: `event-description-${id}` },
    categories: { viewTransitionName: `event-categories-${id}` },
  } as const
}
