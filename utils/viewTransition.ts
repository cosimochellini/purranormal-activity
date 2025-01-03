export function startViewTransition(callback: () => void) {
  if (!(document).startViewTransition) {
    callback()
    return
  }

  (document).startViewTransition(callback)
}
