import type { CSSProperties } from 'react'
import { cx } from '../cx'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  /** CSS width (number = px). Default 100%. */
  width?: number | string
  /** CSS height (number = px). Default 1em. */
  height?: number | string
  /** Corner radius matching what it stands in for. Default xs. */
  radius?: 'xs' | 'sm' | 'sheet' | 'pill'
  className?: string
  style?: CSSProperties
}

/**
 * A placeholder block shaped like the content it replaces. Hidden from assistive technology:
 * mark the loading region with aria-busy and a visually hidden "Loading…" instead.
 */
export function Skeleton({ width = '100%', height = '1em', radius = 'xs', className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.skeleton, radius !== 'xs' && styles[radius], className)}
      style={{ width, height, ...style }}
    />
  )
}

export interface SkeletonTextProps {
  /** Number of lines. Default 3. */
  lines?: number
  /** Text size the lines stand in for. Default md. */
  size?: 'sm' | 'md' | 'lg' | 'question' | 'title'
  /** Width of the last line, so the block reads as a paragraph. Default 60%. */
  lastLineWidth?: string
  className?: string
}

/** Placeholder lines matching the height and rhythm of real text. */
export function SkeletonText({ lines = 3, size = 'md', lastLineWidth = '60%', className }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className={cx(styles.text, styles[`size-${size}`], className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={styles.line}
          height="0.75em"
          width={index === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          radius="xs"
        />
      ))}
    </span>
  )
}
