import { useEffect, useEffectEvent, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Focusable, visible elements inside a container, in tab order. */
export function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  )
}

/** Active traps, innermost last: only the innermost one (a dialog over a dialog) handles Tab. */
const trapStack: object[] = []

export interface FocusTrapOptions {
  /** Element to focus first. Defaults to the first focusable element, else the container. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Return focus to whatever had it before the trap opened. Default true. */
  restoreFocus?: boolean
  /**
   * Where focus goes on close when there is no opener to go back to: it has left the document
   * (a button in a toast that has since gone), or nothing had focus when the trap opened. Called
   * at that moment, so it can look up the current element.
   */
  returnFocus?: () => HTMLElement | null
}

/**
 * Keeps keyboard focus inside `container` while `active`: moves focus in on open, wraps Tab and
 * Shift+Tab at the ends, and gives focus back to the opener when it closes.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  { initialFocus, restoreFocus = true, returnFocus }: FocusTrapOptions = {},
): void {
  // An effect event, so an inline callback doesn't re-run the trap (and steal focus) every render.
  const fallbackTarget = useEffectEvent(() => returnFocus?.() ?? null)

  useEffect(() => {
    const root = container.current
    if (!active || !root) return

    // With nothing focused the active element is <body>, which can't take focus back.
    const focused = document.activeElement
    const opener = focused instanceof HTMLElement && focused !== document.body ? focused : null
    const token = {}
    trapStack.push(token)

    const target = initialFocus?.current ?? focusableElements(root)[0] ?? root
    target.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || trapStack[trapStack.length - 1] !== token) return
      const items = focusableElements(root)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        event.preventDefault()
        root.focus()
        return
      }
      const current = document.activeElement
      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      } else if (!root.contains(current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      trapStack.splice(trapStack.indexOf(token), 1)
      if (!restoreFocus) return
      const target = opener?.isConnected ? opener : fallbackTarget()
      target?.focus({ preventScroll: true })
    }
  }, [active, container, initialFocus, restoreFocus])
}
