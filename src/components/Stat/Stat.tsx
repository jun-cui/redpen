import type { ReactNode } from 'react'
import { cx } from '../cx'
import styles from './Stat.module.css'

export interface StatProps {
  /** The number, set large in the serif. */
  value: ReactNode
  /** What it counts, e.g. "Due today". */
  label: ReactNode
  /** A quiet line under the label, e.g. "Next in 3 h". */
  hint?: ReactNode
  /** md (36px number, default) or lg (48px+). */
  size?: 'md' | 'lg'
  /** Set the number in red: only for something that needs doing now. */
  accent?: boolean
  className?: string
}

/** A headline number with its label, for the home page. Reads "label: value" to screen readers. */
export function Stat({ value, label, hint, size = 'md', accent = false, className }: StatProps) {
  return (
    <div className={cx(styles.stat, size === 'lg' && styles.lg, accent && styles.accent, className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}
