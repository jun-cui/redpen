// Tap to skip: while pen marks are drawing, a tap anywhere on the marking area finishes them all
// at once.
//
// Each mark is given a stamp when it starts drawing (an increasing number, from an event
// handler). A skip records the stamp it happened at; every mark stamped at or before it is shown
// finished (`instant`). A mark started after the skip (the student ticks another point) draws
// as usual, and a mark never flips back from instant to drawing, which would redraw it.

import { useCallback, useRef, useState } from 'react'

export interface MarkClock {
  /** Call from an event handler when marks start drawing; returns the stamp to give them. */
  stamp: (drawSeconds: number) => number
  /** Finishes every mark still drawing. Does nothing when nothing is drawing. */
  skip: () => void
  /** Whether marks with this stamp should be shown finished. */
  isInstant: (stamp: number) => boolean
}

export function useMarkClock(): MarkClock {
  const counter = useRef(0)
  const drawingUntil = useRef(0)
  const [skippedAt, setSkippedAt] = useState(-1)

  const stamp = useCallback((drawSeconds: number) => {
    counter.current += 1
    drawingUntil.current = Math.max(drawingUntil.current, performance.now() + drawSeconds * 1000)
    return counter.current
  }, [])

  const skip = useCallback(() => {
    if (performance.now() >= drawingUntil.current) return
    drawingUntil.current = 0
    setSkippedAt(counter.current)
  }, [])

  const isInstant = useCallback((value: number) => value <= skippedAt, [skippedAt])

  return { stamp, skip, isInstant }
}
