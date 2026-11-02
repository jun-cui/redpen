import { useEffect } from 'react'

let locks = 0
let previous: { html: string; body: string } | null = null

function lock() {
  locks += 1
  if (locks > 1) return
  const html = document.documentElement
  previous = { html: html.style.overflow, body: document.body.style.overflow }
  html.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function unlock() {
  locks = Math.max(0, locks - 1)
  if (locks > 0 || !previous) return
  document.documentElement.style.overflow = previous.html
  document.body.style.overflow = previous.body
  previous = null
}

/** Stops the page behind an overlay from scrolling while `active`. Nested locks are counted. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
