import { useMemo, useRef } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { PEN_DURATIONS } from '../../lib/motion'
import { PenInk, type PenMarkProps } from './PenInk'
import { strikeGeometry, underlineGeometry, type MarkOptions, type PenGeometry } from './paths'
import styles from './pen.module.css'

export interface PenLineProps extends PenMarkProps {
  /**
   * Width in px. Omit it to fill the nearest positioned ancestor instead: put the mark inside a
   * `position: relative` element wrapping the text, and it measures and follows that element.
   */
  width?: number
  /** Height in px of the band the line is drawn in. Defaults to 16, or the parent's height when filling. */
  height?: number
  /** Peak nib width in px. Defaults to a width that suits the band height (about 2px). */
  weight?: number
}

type LineKind = 'strike' | 'underline'

const BUILD: Record<LineKind, (seed: string, width: number, height: number, options: MarkOptions) => PenGeometry> = {
  strike: strikeGeometry,
  underline: underlineGeometry,
}

/** Longer lines take a little longer to draw, as a hand would. */
function lineDuration(kind: LineKind, width: number) {
  return PEN_DURATIONS[kind] * Math.min(Math.max(width / 160, 0.75), 1.6)
}

function SizedLine({
  kind,
  width,
  height,
  weight,
  seed,
  duration,
  ...rest
}: PenLineProps & { kind: LineKind; width: number; height: number; seed: string }) {
  const geometry = useMemo(() => BUILD[kind](seed, width, height, { weight }), [kind, seed, width, height, weight])
  return <PenInk geometry={geometry} width={width} height={height} duration={duration ?? lineDuration(kind, width)} {...rest} />
}

function FillingLine({ kind, height, ...rest }: PenLineProps & { kind: LineKind; seed: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const size = useElementSize(box)
  return (
    <span ref={box} className={kind === 'strike' ? styles.fill : styles.underlineFill} aria-hidden={rest.label ? undefined : true}>
      {size && size.width > 0 ? (
        <SizedLine kind={kind} width={size.width} height={height ?? Math.max(size.height, 6)} {...rest} />
      ) : null}
    </span>
  )
}

/**
 * An irregular strike-through, drawn left to right. Give it a width, or omit the width to lay it
 * over the text of its positioned parent:
 *
 * <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>wrong words<PenStrike delay={0.2} seed={id} /></span>
 *
 * The parent must stay on one line: strike a phrase that wraps one line at a time.
 */
export function PenStrike({ width, height, seed = 'strike', ...rest }: PenLineProps) {
  if (width === undefined) return <FillingLine kind="strike" height={height} seed={seed} {...rest} />
  return <SizedLine kind="strike" width={width} height={height ?? 16} seed={seed} {...rest} />
}

/**
 * A hand-drawn underline that lifts at the end. Give it a width, or omit the width to sit just
 * below the text of its positioned parent.
 */
export function PenUnderline({ width, height, seed = 'underline', ...rest }: PenLineProps) {
  if (width === undefined) return <FillingLine kind="underline" height={height} seed={seed} {...rest} />
  return <SizedLine kind="underline" width={width} height={height ?? 12} seed={seed} {...rest} />
}
