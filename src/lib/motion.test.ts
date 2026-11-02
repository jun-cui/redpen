import type { Variant, Variants } from 'motion/react'
import { describe, expect, it } from 'vitest'
import {
  bottomSheetVariants,
  cardFadeVariants,
  cardSwapVariants,
  dialogVariants,
  fadeVariants,
  pageFadeVariants,
  pageVariants,
} from './motion'

/** The values a variant animates for a given `custom`, leaving out its timing. */
function animatedValues(variant: Variant | undefined, custom: unknown): string[] {
  const target = typeof variant === 'function' ? variant(custom, {}, {}) : variant
  if (typeof target !== 'object') return []
  return Object.keys(target).filter((key) => key !== 'transition' && key !== 'transitionEnd')
}

// Under reduced motion Motion makes transforms instant, so an exit that moves would jump while
// still visible. Each moving set has a twin that only fades, with the same labels so it can be
// swapped in without touching the JSX.
const twins: [string, Variants, Variants][] = [
  ['pageVariants', pageVariants, pageFadeVariants],
  ['cardSwapVariants', cardSwapVariants, cardFadeVariants],
  ['dialogVariants', dialogVariants, fadeVariants],
  ['bottomSheetVariants', bottomSheetVariants, fadeVariants],
]

describe('reduced-motion variants', () => {
  it.each(twins)('%s has an opacity-only twin with the same labels', (_name, moving, fading) => {
    expect(Object.keys(fading).sort()).toEqual(Object.keys(moving).sort())
    for (const label of Object.keys(fading)) {
      for (const direction of [1, -1, 0]) {
        expect(animatedValues(fading[label], direction)).toEqual(['opacity'])
      }
    }
  })
})
