import { Link, type LinkComponent } from '@tanstack/react-router'

/**
 * Typed router `Link` with view transitions on. Preloading is left to the
 * router's `defaultPreload: 'intent'`.
 */
export const TransitionLink: LinkComponent<'a'> = (props) => <Link viewTransition {...props} />
