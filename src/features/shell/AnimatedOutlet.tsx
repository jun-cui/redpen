import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  NavigationType,
  UNSAFE_LocationContext as LocationContext,
  useLocation,
  useMatches,
  useNavigationType,
  useOutlet,
  type Location,
} from 'react-router'
import { pageFadeVariants, pageVariants, type Direction } from '../../lib/motion'
import { rememberScroll, savedScroll, scrollWindowTo } from './scrollMemory'
import styles from './AnimatedOutlet.module.css'

function segments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

/**
 * Which way a route change travels. Deeper within the same section (/cards to /cards/abc) moves
 * forward, shallower moves back; switching sections is a quiet fade with no sideways travel,
 * like changing tabs.
 */
export function directionBetween(from: string, to: string): Direction {
  const a = segments(from)
  const b = segments(to)
  if (a[0] !== b[0]) return 0
  if (b.length > a.length) return 1
  if (b.length < a.length) return -1
  return 0
}

interface TransitionState {
  pathname: string
  direction: Direction
  /** A route change has happened since this outlet mounted. */
  navigated: boolean
}

export interface AnimatedOutletProps {
  className?: string
  /** Animate the first page in when the outlet mounts. Default true. */
  animateFirst?: boolean
}

/**
 * The route's <Outlet/> with page transitions. Keyed on the matched route (its pattern), so a
 * query-string change or a new :param re-renders the page in place instead of animating.
 *
 * The leaving page keeps the outlet element it had (AnimatePresence holds on to it) and the
 * location it was rendered for (LocationContext is frozen per page), so it never re-renders as
 * the next page while it animates away. The next page waits for it (mode="wait"), then scrolls
 * to the top, or back to where the reader was on back/forward.
 */
export function AnimatedOutlet({ className, animateFirst = true }: AnimatedOutletProps) {
  const outlet = useOutlet()
  const location = useLocation()
  const navigationType = useNavigationType()
  const matches = useMatches()
  const routeKey = matches[matches.length - 1]?.id ?? location.pathname
  const reduceMotion = useReducedMotion()

  const [transition, setTransition] = useState<TransitionState>({
    pathname: location.pathname,
    direction: 0,
    navigated: false,
  })
  if (transition.pathname !== location.pathname) {
    setTransition({
      pathname: location.pathname,
      direction: directionBetween(transition.pathname, location.pathname),
      navigated: true,
    })
  }

  const restoreTo = navigationType === NavigationType.Pop ? savedScroll(location.key) : 0

  return (
    <AnimatePresence mode="wait" initial={animateFirst} custom={transition.direction}>
      <motion.div
        key={routeKey}
        className={className}
        custom={transition.direction}
        variants={reduceMotion ? pageFadeVariants : pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <RouteFrame
          location={location}
          navigationType={navigationType}
          restoreTo={restoreTo}
          focusOnMount={transition.navigated}
        >
          {outlet}
        </RouteFrame>
      </motion.div>
    </AnimatePresence>
  )
}

interface RouteFrameProps {
  location: Location
  navigationType: NavigationType
  restoreTo: number
  focusOnMount: boolean
  children: ReactNode
}

function RouteFrame({ location, navigationType, restoreTo, focusOnMount, children }: RouteFrameProps) {
  const isPresent = useIsPresent()
  const frame = useRef<HTMLDivElement>(null)
  const scrolledFor = useRef<string | null>(null)
  /** Captured when the page arrives; later renders of the same page don't move focus. */
  const [focusOnArrival] = useState(focusOnMount)

  // Frozen per page: a leaving page keeps seeing the location it was rendered for.
  const locationContext = useMemo(() => ({ location, navigationType }), [location, navigationType])

  // Scroll when the page arrives, and when its path changes in place (/cards/a to /cards/b),
  // but not when only the query string changes (filters, tabs within a page).
  useLayoutEffect(() => {
    if (!isPresent || scrolledFor.current === location.pathname) return
    scrolledFor.current = location.pathname
    scrollWindowTo(restoreTo)
  }, [isPresent, location.pathname, restoreTo])

  // Move focus into the new page for keyboard and screen-reader users, unless the page has
  // already focused something of its own (an autofocused field).
  useEffect(() => {
    if (!focusOnArrival) return
    const node = frame.current
    if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true })
  }, [focusOnArrival])

  // Remember the scroll position while this page is the current one.
  useEffect(() => {
    if (!isPresent) return
    let request = 0
    const onScroll = () => {
      cancelAnimationFrame(request)
      request = requestAnimationFrame(() => rememberScroll(location.key, window.scrollY))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(request)
      window.removeEventListener('scroll', onScroll)
    }
  }, [isPresent, location.key])

  return (
    <LocationContext value={locationContext}>
      <div ref={frame} tabIndex={-1} className={styles.frame}>
        {children}
      </div>
    </LocationContext>
  )
}
