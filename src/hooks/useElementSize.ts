import { useLayoutEffect, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** The border-box size of an element, kept up to date with a ResizeObserver. Null until measured. */
export function useElementSize(ref: RefObject<Element | null>): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    // ResizeObserver reports once immediately on observe, then on every change.
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize[0]
      const width = box ? box.inlineSize : (entry?.contentRect.width ?? 0)
      const height = box ? box.blockSize : (entry?.contentRect.height ?? 0)
      setSize((prev) =>
        prev && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
