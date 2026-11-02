import { motion } from 'motion/react'
import { springs } from '../../lib/motion'
import { cx } from '../cx'
import styles from './ProgressBar.module.css'

export interface ProgressBarProps {
  /** Progress so far, from 0 to max. */
  value: number
  /** Default 1, so value can be a fraction. */
  max?: number
  /** Accessible name, e.g. "Review progress". */
  label: string
  /** Read out instead of a percentage, e.g. "3 of 12 cards". */
  valueText?: string
  /** ink (default) or red. */
  tone?: 'ink' | 'red'
  /** 2px (default) or 4px. */
  thickness?: 'thin' | 'thick'
  className?: string
}

/** A thin ink line that springs forward as progress is made (e.g. through a review session). */
export function ProgressBar({ value, max = 1, label, valueText, tone = 'ink', thickness = 'thin', className }: ProgressBarProps) {
  const fraction = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
      aria-valuetext={valueText}
      className={cx(styles.track, tone === 'red' && styles.red, thickness === 'thick' && styles.thick, className)}
    >
      <motion.span className={styles.fill} initial={false} animate={{ scaleX: fraction }} transition={springs.gentle} />
    </span>
  )
}
