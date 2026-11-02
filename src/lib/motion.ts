// Motion presets: springs, variants and pen-mark timing.
//
// Reduced motion: the app root renders <MotionConfig reducedMotion="user">. For people who ask for
// less motion, Motion then makes transform and layout animations instant while opacity still
// animates. That is enough for anything that fades in, or moves only a little as it leaves. A
// bigger exit would jump to its end position while still visible, so the page transition, the
// card swap and dialogs (the bottom sheet) have opacity-only twins with the same labels:
// pageFadeVariants, cardFadeVariants and fadeVariants. Pick them with useReducedMotion().
// Pen strokes animate pathLength, which MotionConfig does not cover, so pen components check
// useReducedMotion() and fade the finished mark in instead of drawing it.
//
// Animate only transform, opacity and SVG stroke (pathLength). CSS mirrors springs.ui with
// --ease-spring / --duration-spring for hover and press transitions.

import type { Transition, Variants } from 'motion/react'

type CubicBezier = [number, number, number, number]

export const easings = {
  /** Matches --ease-out: quick start, long gentle settle. */
  out: [0.22, 1, 0.36, 1] as CubicBezier,
  /** Matches --ease-in-out. */
  inOut: [0.65, 0, 0.35, 1] as CubicBezier,
  /** A pen stroke: the hand accelerates into the line and eases off as it lifts. */
  pen: [0.42, 0, 0.28, 1] as CubicBezier,
}

export const springs = {
  /** Presses, toggles, indicators: quick and settled, a hint of give. */
  ui: { type: 'spring', visualDuration: 0.22, bounce: 0.12 },
  /** Sheets, dialogs, cards arriving: softer, with a little follow-through. */
  gentle: { type: 'spring', visualDuration: 0.38, bounce: 0.1 },
  /** Route changes: no bounce, settles fast so navigation never feels slow. */
  page: { type: 'spring', visualDuration: 0.3, bounce: 0 },
} as const satisfies Record<string, Transition>

export const fades = {
  /** --duration-fast */
  fast: { duration: 0.14, ease: easings.out },
  /** --duration-base */
  base: { duration: 0.22, ease: easings.out },
} as const satisfies Record<string, Transition>

/** Scale for pressed buttons and tappable surfaces (CSS uses the same value). */
export const PRESS_SCALE = 0.97

/** Direction of travel for page and card transitions: 1 forward, -1 back, 0 neither (tabs). */
export type Direction = 1 | -1 | 0

/**
 * Page transitions. Pass the direction as `custom` on both the motion element and its
 * <AnimatePresence>, so the leaving page knows where to go:
 * forward pushes the old page left as the new one arrives from the right; back reverses it;
 * 0 (switching tabs) is a short fade and rise with no sideways travel.
 */
export const pageVariants: Variants = {
  initial: (direction: Direction = 0) =>
    direction === 0 ? { opacity: 0, y: 8, x: 0 } : { opacity: 0, x: 32 * direction, y: 0 },
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { x: springs.page, y: springs.page, opacity: fades.base },
  },
  exit: (direction: Direction = 0) => ({
    opacity: 0,
    x: direction === 0 ? 0 : -24 * direction,
    transition: { duration: 0.16, ease: easings.out },
  }),
}

/** pageVariants for reduced motion: the same labels, opacity only. */
export const pageFadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: fades.base },
  exit: { opacity: 0, transition: { duration: 0.16, ease: easings.out } },
}

/**
 * Review card swap. The marked card is set aside to the left with a slight turn, as if slid off
 * the pile, while the next card arrives from the right. Use with
 * <AnimatePresence mode="popLayout" custom={direction}> and initial="enter" animate="center" exit="exit".
 */
export const cardSwapVariants: Variants = {
  enter: (direction: Direction = 1) => ({
    opacity: 0,
    x: direction === 0 ? 0 : 56 * direction,
    y: direction === 0 ? 12 : 0,
    rotate: direction * 1.5,
    scale: 0.985,
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    transition: { ...springs.gentle, opacity: fades.base },
  },
  exit: (direction: Direction = 1) => ({
    opacity: 0,
    x: direction === 0 ? 0 : -72 * direction,
    y: direction === 0 ? -8 : 6,
    rotate: direction * -2,
    scale: 0.98,
    // A fixed-length exit, not a spring: AnimatePresence keeps the (invisible, popped-out) card
    // in the page until its animation settles, and a spring's long tail holds the scroll height open.
    transition: { duration: 0.3, ease: easings.out, opacity: { duration: 0.2, ease: easings.out } },
  }),
}

/** cardSwapVariants for reduced motion: the same labels, opacity only. */
export const cardFadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: fades.base },
  exit: { opacity: 0, transition: { duration: 0.2, ease: easings.out } },
}

/** Plain fade, for content that swaps in place (loading → loaded), and dialogs at reduced motion. */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fades.base },
  exit: { opacity: 0, transition: fades.fast },
}

/** Fade and rise a few pixels: list items and sections appearing. */
export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { y: springs.gentle, opacity: fades.base } },
  exit: { opacity: 0, transition: fades.fast },
}

/** Parent for riseVariants children: staggers them in. Keep lists short (first ~8 items). */
export function staggerVariants(stagger = 0.04, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren } },
  }
}

/** Dialog centred on larger screens. */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { ...springs.gentle, opacity: fades.fast } },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.14, ease: easings.out } },
}

/** Bottom sheet on phones. */
export const bottomSheetVariants: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { y: springs.gentle, opacity: fades.fast } },
  exit: { y: '100%', opacity: 0, transition: { y: { duration: 0.22, ease: easings.inOut }, opacity: { duration: 0.2, delay: 0.04 } } },
}

/** The dimmed backdrop behind dialogs. */
export const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fades.base },
  exit: { opacity: 0, transition: { duration: 0.18, ease: easings.out } },
}

// ---------------------------------------------------------------------------
// Pen timing
// ---------------------------------------------------------------------------

/** Kinds of mark in a marking sequence, in the order an examiner makes them. */
export type PenStep =
  | 'strike' // strike through a wrong phrase
  | 'note' // a correction written in red
  | 'tick' // a key point earned
  | 'cross' // a key point missed
  | 'missing' // a missing point written at the end
  | 'underline'
  | 'score' // the circled score in the margin, always last

/** Natural duration of each mark in seconds, before any compression. */
export const PEN_DURATIONS: Readonly<Record<PenStep, number>> = {
  strike: 0.24,
  note: 0.32,
  tick: 0.26,
  cross: 0.3,
  missing: 0.34,
  underline: 0.26,
  score: 0.5,
}

/** The whole marking sequence finishes within this many seconds. */
export const PEN_BUDGET = 1.4

/** Pause between marks while the pen moves to the next place. */
export const PEN_GAP = 0.05

export interface PenSlot {
  /** Seconds from the start of the sequence. */
  delay: number
  /** Seconds the mark takes to draw. */
  duration: number
}

export interface PenTimingOptions {
  /** Seconds before the first mark (e.g. while the sheet settles). Counts towards the budget. */
  start?: number
  /** Latest finishing time in seconds. Defaults to PEN_BUDGET. */
  budget?: number
  /** Pause between marks. Defaults to PEN_GAP. */
  gap?: number
}

/**
 * Schedules a marking sequence like one examiner's hand: marks one after another with a short
 * pen-lift between them. If the natural schedule would overrun the budget, every duration and
 * gap is scaled down by the same factor, so long answers mark faster rather than slower.
 * Pass the steps in drawing order with 'score' last; the slots line up with the steps.
 *
 * @example
 * const [strike, note, tickA, tickB, score] = penTiming(['strike', 'note', 'tick', 'tick', 'score'])
 * <PenTick delay={tickA.delay} duration={tickA.duration} />
 */
export function penTiming(steps: readonly PenStep[], options: PenTimingOptions = {}): PenSlot[] {
  const { start = 0, budget = PEN_BUDGET, gap = PEN_GAP } = options
  if (steps.length === 0) return []

  const natural = steps.reduce((sum, step) => sum + PEN_DURATIONS[step], 0) + gap * (steps.length - 1)
  const available = Math.max(budget - start, 0.1)
  const scale = Math.min(1, available / natural)

  const slots: PenSlot[] = []
  let cursor = start
  for (const step of steps) {
    const duration = PEN_DURATIONS[step] * scale
    slots.push({ delay: round(cursor), duration: round(duration) })
    cursor += duration + gap * scale
  }
  return slots
}

/** When the last slot finishes, in seconds. */
export function penTimingEnd(slots: readonly PenSlot[]): number {
  const last = slots[slots.length - 1]
  return last ? round(last.delay + last.duration) : 0
}

function round(seconds: number) {
  return Math.round(seconds * 1000) / 1000
}
