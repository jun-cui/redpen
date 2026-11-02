import { useLayoutEffect } from 'react'

/** Toasts just above the home indicator: for screens without the tab bar. */
export const TOAST_OFFSET_NO_TABBAR = 'calc(var(--safe-bottom) + var(--space-2))'

/**
 * Moves toasts (portalled to <body>) while the calling screen is mounted, by setting
 * --toast-bottom on <html>. From 1024px toasts sit bottom-right regardless.
 */
export function useToastOffset(bottom: string) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--toast-bottom', bottom)
    return () => {
      root.style.removeProperty('--toast-bottom')
    }
  }, [bottom])
}
