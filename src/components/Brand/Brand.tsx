import { cx } from '../cx'
import { PenInk } from '../pen/PenInk'
import { BRAND_TICK } from '../pen/paths'
import styles from './Brand.module.css'

export interface BrandMarkProps {
  /** Size in px. Default 32. Inside a Wordmark it follows the text size instead. */
  size?: number
  /** Draw the tick on a square of paper, like the app icon. */
  tile?: boolean
  /** Draw the tick on with the pen when it appears (e.g. on the sign-in screen). */
  animated?: boolean
  /** Seconds before an animated tick starts. */
  delay?: number
  /** Accessible name. Omit when the mark sits next to the word "Redpen". */
  title?: string
  className?: string
}

/** The Redpen logo: a red pen tick. */
export function BrandMark({ size, tile = false, animated = false, delay = 0, title, className }: BrandMarkProps) {
  return (
    <span
      className={cx(styles.mark, tile && styles.tile, className)}
      style={size !== undefined ? { width: size, height: size } : undefined}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {animated ? (
        <PenInk geometry={BRAND_TICK} width={BRAND_TICK.width} height={BRAND_TICK.height} duration={0.45} delay={delay} />
      ) : (
        <svg viewBox={`0 0 ${BRAND_TICK.width} ${BRAND_TICK.height}`} fill="currentColor" focusable="false">
          {BRAND_TICK.strokes.flatMap((stroke) => stroke.ink).map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      )}
    </span>
  )
}

export interface WordmarkProps {
  /** sm 18px, md 22px (default), lg 36px. */
  size?: 'sm' | 'md' | 'lg'
  /** Draw the tick on when it appears. */
  animated?: boolean
  className?: string
}

/** "Redpen" set in Fraunces beside the red tick. Reads as "Redpen" to screen readers. */
export function Wordmark({ size = 'md', animated = false, className }: WordmarkProps) {
  return (
    <span className={cx(styles.wordmark, styles[size], className)}>
      <BrandMark animated={animated} delay={0.15} />
      <span>Redpen</span>
    </span>
  )
}
