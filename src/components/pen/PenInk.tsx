import { motion, useReducedMotion } from 'motion/react'
import { useId, useMemo, type CSSProperties } from 'react'
import { easings } from '../../lib/motion'
import { cx } from '../cx'
import styles from './pen.module.css'
import type { InkStroke, PenGeometry } from './paths'

/** Props shared by every pen mark. */
export interface PenMarkProps {
  /** Show the mark: it is drawn on when this becomes true and hidden when false. Default true. */
  drawn?: boolean
  /** Seconds before the pen starts. */
  delay?: number
  /** Seconds the mark takes to draw. Each mark has a natural default (see PEN_DURATIONS). */
  duration?: number
  /** Show the finished mark at once, e.g. when the reader taps to skip the marking. */
  instant?: boolean
  /** Same seed, same mark. Pass something stable, such as the key point id. */
  seed?: string
  /** Accessible name. Without one the mark is decorative and hidden from assistive technology. */
  label?: string
  className?: string
  style?: CSSProperties
}

interface PenInkProps extends Omit<PenMarkProps, 'seed' | 'duration'> {
  geometry: PenGeometry
  width: number
  height: number
  duration: number
}

/** Pause while the pen lifts between the strokes of one mark (a cross). */
const PEN_LIFT = 0.06

/** How long a finished mark takes to fade in when motion is reduced. */
const REDUCED_FADE = 0.2

interface StrokeTiming {
  delay: number
  duration: number
}

function strokeTimings(strokes: readonly InkStroke[], delay: number, duration: number): StrokeTiming[] {
  const lifts = PEN_LIFT * Math.max(strokes.length - 1, 0)
  const drawing = Math.max(duration - lifts, 0.05)
  const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0) || 1
  let cursor = delay
  return strokes.map((stroke) => {
    const share = drawing * (stroke.length / total)
    const timing = { delay: cursor, duration: share }
    cursor += share + PEN_LIFT
    return timing
  })
}

/**
 * Renders pen geometry as red ink revealed in pen order. The ink shapes (with their pressure-
 * varied width) sit under a mask; the mask draws each centre line with pathLength, so the ink
 * appears as if written. With reduced motion the finished mark fades in at the same moment.
 */
export function PenInk({
  geometry,
  width,
  height,
  drawn = true,
  delay = 0,
  duration,
  instant = false,
  label,
  className,
  style,
}: PenInkProps) {
  const reduceMotion = useReducedMotion() ?? false
  const maskId = `pen-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const timings = useMemo(() => strokeTimings(geometry.strokes, delay, duration), [geometry, delay, duration])
  const mode = instant ? 'instant' : reduceMotion ? 'fade' : 'draw'

  const { width: w, height: h } = geometry
  const visible = { opacity: drawn ? 1 : 0 }

  return (
    <svg
      className={cx(styles.mark, className)}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-w * 0.25} y={-h * 0.25} width={w * 1.5} height={h * 1.5}>
          {geometry.strokes.map((stroke, index) => {
            const common = {
              d: stroke.centre,
              fill: 'none',
              stroke: '#fff',
              strokeWidth: stroke.revealWidth,
              strokeLinecap: 'round' as const,
              strokeLinejoin: 'round' as const,
            }
            if (mode !== 'draw') return <path key={`${mode}-${index}`} {...common} />
            const timing = timings[index] ?? { delay, duration }
            return (
              <motion.path
                key={`draw-${index}`}
                {...common}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={drawn ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={
                  drawn
                    ? {
                        pathLength: { delay: timing.delay, duration: timing.duration, ease: easings.pen },
                        // Hide the round-cap dot a zero-length stroke would show before the pen lands.
                        opacity: { delay: timing.delay, duration: 0.01 },
                      }
                    : { duration: 0 }
                }
              />
            )
          })}
        </mask>
      </defs>
      <motion.g
        key={mode}
        mask={`url(#${maskId})`}
        fill="currentColor"
        initial={mode === 'fade' ? { opacity: 0 } : false}
        animate={visible}
        transition={mode === 'fade' && drawn ? { delay, duration: REDUCED_FADE, ease: easings.out } : { duration: 0 }}
      >
        {geometry.strokes.flatMap((stroke, strokeIndex) =>
          stroke.ink.map((d, partIndex) => <path key={`${strokeIndex}-${partIndex}`} d={d} />),
        )}
      </motion.g>
    </svg>
  )
}
