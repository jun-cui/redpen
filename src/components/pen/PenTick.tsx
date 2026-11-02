import { useMemo } from 'react'
import { PEN_DURATIONS } from '../../lib/motion'
import { PenInk, type PenMarkProps } from './PenInk'
import { crossGeometry, tickGeometry } from './paths'

export interface PenTickProps extends PenMarkProps {
  /** Rendered size in px. Default 28. */
  size?: number
}

/** A hand-drawn examiner's tick: short light down-stroke, long confident sweep up to the right. */
export function PenTick({ size = 28, seed = 'tick', duration = PEN_DURATIONS.tick, ...rest }: PenTickProps) {
  const geometry = useMemo(() => tickGeometry(seed), [seed])
  return <PenInk geometry={geometry} width={size} height={size} duration={duration} {...rest} />
}

export interface PenCrossProps extends PenMarkProps {
  /** Rendered size in px. Default 22. */
  size?: number
}

/** A small hand-drawn cross: two quick strokes with a pen lift between them. */
export function PenCross({ size = 22, seed = 'cross', duration = PEN_DURATIONS.cross, ...rest }: PenCrossProps) {
  const geometry = useMemo(() => crossGeometry(seed), [seed])
  return <PenInk geometry={geometry} width={size} height={size} duration={duration} {...rest} />
}
