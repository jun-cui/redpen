import { useCallback, useSyncExternalStore } from 'react'

/** Desktop layout breakpoint: sidebar navigation, side-by-side answer and marking. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

/** Tablet and up: centred dialogs instead of bottom sheets, wider gutters. */
export const TABLET_QUERY = '(min-width: 600px)'

const queries = new Map<string, MediaQueryList>()

function mediaQueryList(query: string): MediaQueryList {
  let list = queries.get(query)
  if (!list) {
    list = window.matchMedia(query)
    queries.set(query, list)
  }
  return list
}

/** Whether a CSS media query matches; re-renders when it changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaQueryList(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => mediaQueryList(query).matches,
    () => false,
  )
}

/** True at 1024px and wider. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}

/** True at 600px and wider. */
export function useIsTabletUp(): boolean {
  return useMediaQuery(TABLET_QUERY)
}

/** True when running as an installed app (iOS "Add to Home Screen" or a desktop PWA window). */
export function useIsStandalone(): boolean {
  const displayStandalone = useMediaQuery('(display-mode: standalone)')
  const iosStandalone =
    typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true
  return displayStandalone || iosStandalone
}
