import { motion } from 'motion/react'
import { useMemo, type ReactNode } from 'react'
import { easings, PEN_DURATIONS } from '../../lib/motion'
import { cx } from '../cx'
import { PenInk, type PenMarkProps } from './PenInk'
import { circleGeometry } from './paths'
import styles from './pen.module.css'

export interface PenCircleProps extends PenMarkProps {
  /** Box width in px. Default 64. */
  width?: number
  /** Box height in px. Default 48. */
  height?: number
  /** Content centred inside the ring. */
  children?: ReactNode
}

/** A hand-drawn ring that overshoots its start, around optional centred content. */
export function PenCircle({
  width = 64,
  height = 48,
  seed = 'circle',
  duration = PEN_DURATIONS.score,
  children,
  className,
  style,
  ...rest
}: PenCircleProps) {
  const geometry = useMemo(() => circleGeometry(seed, width, height), [seed, width, height])
  return (
    <span className={cx(styles.circle, className)} style={{ width, height, ...style }}>
      {children}
      <PenInk geometry={geometry} width={width} height={height} duration={duration} {...rest} />
    </span>
  )
}

export interface ScoreMarkProps extends Omit<PenMarkProps, 'label'> {
  score: number
  total: number
  /** sm for compact places (a docked score, list rows), md for the review sheet margin, lg for a summary. Default md. */
  size?: 'sm' | 'md' | 'lg'
}

/** Score text size in px for each ScoreMark size: --text-lg, --text-2xl and --text-4xl (see pen.module.css). */
const SCORE_FONT_PX = { sm: 18, md: 28, lg: 48 } as const

/**
 * A ring that clears the written score. Caveat's figures advance 0.45em and its slash 0.33em,
 * and the ink of "3/4" stands about 0.86em tall; the ring adds room so no figure touches it.
 */
function scoreRingSize(text: string, fontPx: number) {
  const em = [...text].reduce((sum, char) => sum + (char === '/' ? 0.33 : 0.45), 0)
  return {
    width: Math.round(em * fontPx * 1.2 + fontPx * 0.8),
    height: Math.round(0.86 * fontPx * 1.4 + fontPx * 0.6),
  }
}

/**
 * The circled mark in the margin, made last: the score is written in red ("3/4") and then
 * circled. `duration` covers both.
 */
export function ScoreMark({
  score,
  total,
  size = 'md',
  seed,
  drawn = true,
  delay = 0,
  duration = PEN_DURATIONS.score,
  instant = false,
  className,
  style,
}: ScoreMarkProps) {
  const text = `${score}/${total}`
  const { width, height } = scoreRingSize(text, SCORE_FONT_PX[size])
  const write = Math.min(0.2, duration * 0.35)
  const ringDelay = delay + write * 0.8

  return (
    <PenCircle
      width={width}
      height={height}
      seed={seed ?? `score-${text}`}
      drawn={drawn}
      delay={ringDelay}
      duration={Math.max(duration - write * 0.8, 0.1)}
      instant={instant}
      className={cx(styles[size], className)}
      style={style}
    >
      <span role="img" aria-label={`Score: ${score} out of ${total}`}>
        <motion.span
          key={instant ? 'instant' : 'write'}
          className={styles.scoreText}
          aria-hidden="true"
          initial={instant ? false : { opacity: 0, y: 3 }}
          animate={drawn ? { opacity: 1, y: 0 } : { opacity: 0, y: 3 }}
          transition={instant || !drawn ? { duration: 0 } : { delay, duration: write, ease: easings.out }}
        >
          {text}
        </motion.span>
      </span>
    </PenCircle>
  )
}
