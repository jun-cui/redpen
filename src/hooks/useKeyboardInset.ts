import { useSyncExternalStore } from 'react'

// iOS Safari does not shrink the layout viewport when the on-screen keyboard opens: fixed and
// bottom-anchored content stays behind the keyboard. The visual viewport does shrink, so the
// covered height is what the layout viewport extends below it. While any component uses this
// hook, the height is kept in --keyboard-inset on <html> for CSS (e.g. padding-bottom on a
// review screen, margin-bottom on a bottom sheet).

/** Smaller changes come from browser toolbars collapsing, not the keyboard. */
const KEYBOARD_THRESHOLD = 80

let inset = 0
let stop: (() => void) | null = null
const listeners = new Set<() => void>()

function measure(): number {
  const viewport = window.visualViewport
  if (!viewport) return 0
  // Pinch-zoom also shrinks the visual viewport; it says nothing about the keyboard.
  if (viewport.scale > 1.01) return 0
  const covered = window.innerHeight - (viewport.height + viewport.offsetTop)
  return covered > KEYBOARD_THRESHOLD ? Math.round(covered) : 0
}

function setInset(next: number) {
  if (next === inset) return
  inset = next
  document.documentElement.style.setProperty('--keyboard-inset', `${next}px`)
  listeners.forEach((listener) => listener())
}

function start() {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  let frame = 0
  const onChange = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => setInset(measure()))
  }
  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)
  onChange()
  return () => {
    cancelAnimationFrame(frame)
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
    setInset(0)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) stop = start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stop?.()
      stop = null
    }
  }
}

export interface KeyboardInset {
  /** Pixels of the layout viewport hidden behind the on-screen keyboard (0 when closed). */
  inset: number
  open: boolean
}

/**
 * Tracks the on-screen keyboard and mirrors its height into the --keyboard-inset CSS variable.
 * Use it on screens with a text box near the bottom so the box can move above the keyboard.
 */
export function useKeyboardInset(): KeyboardInset {
  const value = useSyncExternalStore(
    subscribe,
    () => inset,
    () => 0,
  )
  return { inset: value, open: value > 0 }
}
